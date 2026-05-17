'use client';
import { useState, useRef, useCallback } from 'react';
import { useAudit } from '@/lib/useAudit';
import { AuditResult, ScanInput } from '@/lib/sinveneno-core-engine';
import ResultCard from '@/components/ResultCard';
import BarcodeScanner from '@/components/BarcodeScanner';

type Screen = 'home' | 'barcode' | 'analyzing' | 'result';

export default function Home() {
  const [screen, setScreen] = useState<Screen>('home');
  const [result, setResult] = useState<AuditResult | null>(null);
  const [productName, setProductName] = useState('');
  const [searchText, setSearchText] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { runAudit, isRunning } = useAudit();

  const saveHistory = useCallback(async (res: AuditResult, name: string, method: string, barcode?: string) => {
    try {
      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: name || null,
          barcode: barcode || null,
          status: res.status,
          layer_triggered: res.layerTriggered,
          triggered_tokens: res.triggeredTokens,
          reason: res.reason,
          metal_score: res.metalScore || null,
          execution_ms: res.executionTimeMs,
          method,
        }),
      });
    } catch { /* silent */ }
  }, []);

  // ─── PHOTO FLOW ───────────────────────────────────────────
  const handlePhoto = useCallback(async (file: File) => {
    setScreen('analyzing');
    setError('');
    try {
      const base64 = await fileToBase64(file);
      const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp';

      // Parallel: ingredients + packaging detection
      const [ingredRes, packRes] = await Promise.all([
        fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'photo', imageBase64: base64, imageMediaType: mediaType }),
        }).then(r => r.json()),
        fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'packaging', imageBase64: base64, imageMediaType: mediaType }),
        }).then(r => r.json()),
      ]);

      if (!ingredRes.ingredientsRaw || ingredRes.ingredientsRaw === 'ILEGIBLE') {
        setError('No se pudieron leer los ingredientes. Intenta con mejor iluminación.');
        setScreen('home');
        return;
      }

      const input: ScanInput = {
        ingredientsRaw: ingredRes.ingredientsRaw,
        packagingMaterial: packRes.packaging || 'desconocido',
      };

      const auditResult = await runAudit(input);
      setResult(auditResult);
      setProductName('');
      setScreen('result');
      await saveHistory(auditResult, '', 'photo');
    } catch (e) {
      setError('Error al procesar la imagen.');
      setScreen('home');
    }
  }, [runAudit, saveHistory]);

  // ─── BARCODE FLOW ─────────────────────────────────────────
  const handleBarcode = useCallback(async (barcode: string) => {
    setScreen('analyzing');
    setError('');
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'barcode', barcode }),
      }).then(r => r.json());

      if (!res.ingredientsRaw) {
        setError(`Producto ${barcode} no encontrado. Intenta con foto de la etiqueta.`);
        setScreen('home');
        return;
      }

      const input: ScanInput = {
        ingredientsRaw: res.ingredientsRaw,
        productName: res.productName || barcode,
        category: res.category || '',
      };

      const auditResult = await runAudit(input);
      setResult(auditResult);
      setProductName(res.productName || barcode);
      setScreen('result');
      await saveHistory(auditResult, res.productName || '', 'barcode', barcode);
    } catch {
      setError('Error al buscar el producto.');
      setScreen('home');
    }
  }, [runAudit, saveHistory]);

  // ─── SEARCH FLOW ──────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    if (!searchText.trim()) return;
    setScreen('analyzing');
    setError('');
    try {
      // Search OFF by name
      const res = await fetch(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(searchText)}&search_simple=1&action=process&json=1&page_size=1`
      ).then(r => r.json());

      const product = res.products?.[0];
      if (!product?.ingredients_text) {
        setError('Producto no encontrado. Intenta fotografiar la etiqueta.');
        setScreen('home');
        return;
      }

      const input: ScanInput = {
        ingredientsRaw: product.ingredients_text,
        productName: product.product_name || searchText,
        category: product.categories || '',
      };

      const auditResult = await runAudit(input);
      setResult(auditResult);
      setProductName(product.product_name || searchText);
      setScreen('result');
      await saveHistory(auditResult, product.product_name || searchText, 'search');
    } catch {
      setError('Error en la búsqueda.');
      setScreen('home');
    }
  }, [searchText, runAudit, saveHistory]);

  const reset = () => {
    setScreen('home');
    setResult(null);
    setProductName('');
    setSearchText('');
    setError('');
  };

  // ─── RENDER ───────────────────────────────────────────────
  if (screen === 'barcode') {
    return (
      <BarcodeScanner
        onDetected={handleBarcode}
        onClose={() => setScreen('home')}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#0A0A0A] flex flex-col items-center px-4 py-8 safe-area-inset">
      {/* Header */}
      <div className="w-full max-w-md mb-8">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">🛡️</span>
          <h1 className="text-2xl font-black text-white tracking-tight">SinVeneno</h1>
        </div>
        <p className="text-neutral-500 text-sm ml-12">
          Detecta aceites, metales y microplásticos en 3 segundos
        </p>
      </div>

      {/* Analyzing state */}
      {screen === 'analyzing' && (
        <div className="w-full max-w-md flex flex-col items-center gap-6 mt-16">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border-4 border-green-900" />
            <div className="absolute inset-0 rounded-full border-4 border-green-400 border-t-transparent animate-spin" />
            <span className="absolute inset-0 flex items-center justify-center text-2xl">🔬</span>
          </div>
          <div className="text-center">
            <p className="text-neutral-300 font-semibold">Analizando...</p>
            <p className="text-neutral-600 text-sm mt-1">Motor local — 3 capas en cascada</p>
          </div>
        </div>
      )}

      {/* Result */}
      {screen === 'result' && result && (
        <ResultCard
          result={result}
          productName={productName}
          onReset={reset}
          onSave={() => {}} // already saved on detection
        />
      )}

      {/* Home */}
      {screen === 'home' && (
        <div className="w-full max-w-md space-y-4">
          {error && (
            <div className="bg-red-950 border border-red-800 text-red-300 text-sm rounded-xl p-4">
              {error}
            </div>
          )}

          {/* Photo button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-4 bg-[#111111] hover:bg-[#1a1a1a] border border-neutral-800 hover:border-green-700 text-white rounded-2xl p-5 transition-all group"
          >
            <span className="text-4xl">📷</span>
            <div className="text-left">
              <p className="font-bold text-lg">Fotografiar etiqueta</p>
              <p className="text-neutral-500 text-sm">Claude Vision lee los ingredientes</p>
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handlePhoto(file);
              e.target.value = '';
            }}
          />

          {/* Barcode button */}
          <button
            onClick={() => setScreen('barcode')}
            className="w-full flex items-center gap-4 bg-[#111111] hover:bg-[#1a1a1a] border border-neutral-800 hover:border-green-700 text-white rounded-2xl p-5 transition-all"
          >
            <span className="text-4xl">📊</span>
            <div className="text-left">
              <p className="font-bold text-lg">Escanear código de barras</p>
              <p className="text-neutral-500 text-sm">Open Food Facts → motor local</p>
            </div>
          </button>

          {/* Search */}
          <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-4">
              <span className="text-4xl">🔍</span>
              <div>
                <p className="font-bold text-lg text-white">Buscar por nombre</p>
                <p className="text-neutral-500 text-sm">Base de productos + Claude</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Ej: Sabritas Original, Coca-Cola..."
                className="flex-1 bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-600 text-sm focus:outline-none focus:border-green-700"
              />
              <button
                onClick={handleSearch}
                disabled={!searchText.trim()}
                className="bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white font-bold px-4 rounded-xl transition-colors"
              >
                →
              </button>
            </div>
          </div>

          {/* Three enemies reminder */}
          <div className="bg-[#0f0f0f] border border-neutral-900 rounded-2xl p-4 space-y-2 mt-2">
            <p className="text-neutral-600 text-xs uppercase tracking-widest font-semibold mb-3">Detectamos</p>
            <div className="flex items-start gap-3">
              <span className="text-base">🫒</span>
              <div>
                <p className="text-neutral-400 text-sm font-semibold">Aceites de semillas</p>
                <p className="text-neutral-600 text-xs">Canola, soya, girasol, maíz — y sus camuflajes</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-base">⚗️</span>
              <div>
                <p className="text-neutral-400 text-sm font-semibold">Metales pesados</p>
                <p className="text-neutral-600 text-xs">Inferencia por ingrediente de origen</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-base">🧴</span>
              <div>
                <p className="text-neutral-400 text-sm font-semibold">Microplásticos</p>
                <p className="text-neutral-600 text-xs">Hot-fill, PET, poliestireno con calor</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <p className="text-neutral-800 text-xs mt-10">
        Motor local · La Colmena 2026 · sinveneno.duendes.app
      </p>
    </main>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res((reader.result as string).split(',')[1]);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}
