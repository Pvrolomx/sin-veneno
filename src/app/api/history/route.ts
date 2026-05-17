import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { error } = await supabase.from('sinveneno_history').insert([{
      product_name: body.product_name || null,
      barcode: body.barcode || null,
      status: body.status,
      layer_triggered: body.layer_triggered,
      triggered_tokens: body.triggered_tokens,
      reason: body.reason,
      metal_score: body.metal_score || null,
      execution_ms: body.execution_ms,
      method: body.method,
    }]);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    // History is secondary — never block user flow
    console.error('[/api/history]', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('sinveneno_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json([], { status: 500 });
  }
}
