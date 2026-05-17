import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/scan — handles photo OCR and barcode lookup
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, barcode, imageBase64, imageMediaType } = body;

    if (type === 'barcode' && barcode) {
      // Try Open Food Facts first
      const offRes = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
        { next: { revalidate: 3600 } }
      );
      const offData = await offRes.json();

      if (offData.status === 1 && offData.product?.ingredients_text) {
        return NextResponse.json({
          ingredientsRaw: offData.product.ingredients_text,
          productName: offData.product.product_name || '',
          category: offData.product.categories || '',
          source: 'openfoodfacts',
        });
      }
      // If OFF has no ingredients, fall through to vision
    }

    if (type === 'photo' && imageBase64) {
      // Claude Vision — extract ingredients only
      const visionRes = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: imageMediaType || 'image/jpeg',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `Analiza esta imagen de etiqueta de producto alimenticio.
Extrae ÚNICAMENTE la lista de ingredientes completa, tal como aparece escrita.
No interpretes, no traduzcas, no resumas.
Devuelve SOLO el texto de ingredientes en una línea, separados por comas.
Si no puedes leer la lista de ingredientes, responde: "ILEGIBLE"`,
            },
          ],
        }],
      });

      const ingredientsRaw = visionRes.content[0].type === 'text'
        ? visionRes.content[0].text
        : 'ILEGIBLE';

      return NextResponse.json({ ingredientsRaw, source: 'vision' });
    }

    if (type === 'barcode_vision' && imageBase64) {
      const barcodeRes = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: imageMediaType || 'image/jpeg', data: imageBase64 },
            },
            {
              type: 'text',
              text: `Busca en esta imagen un codigo de barras (EAN-13, UPC, EAN-8 o similar).
Responde SOLO con JSON: {"barcode": "1234567890123"}
Si no hay codigo de barras visible, responde: {"barcode": null}
No incluyas nada mas en tu respuesta.`,
            },
          ],
        }],
      });
      const raw = barcodeRes.content[0].type === 'text' ? barcodeRes.content[0].text : '{}';
      try {
        const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
        return NextResponse.json(parsed);
      } catch {
        return NextResponse.json({ barcode: null });
      }
    }

    if (type === 'packaging' && imageBase64) {
      // Claude Vision — detect packaging material
      const packRes = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: imageMediaType || 'image/jpeg',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `Analiza SOLO el contenedor principal de este producto.
Ignora reflejos, etiquetas y fondo.
Clasifica estrictamente el material del envase.
Responde SOLO con JSON: {"packaging": "plastico"} o {"packaging": "lata"} o {"packaging": "vidrio"} o {"packaging": "tetrapak"} o {"packaging": "desconocido"}`,
            },
          ],
        }],
      });

      const raw = packRes.content[0].type === 'text' ? packRes.content[0].text : '{}';
      try {
        const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
        return NextResponse.json(parsed);
      } catch {
        return NextResponse.json({ packaging: 'desconocido' });
      }
    }

    return NextResponse.json({ error: 'Invalid request type' }, { status: 400 });
  } catch (err) {
    console.error('[/api/scan]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
