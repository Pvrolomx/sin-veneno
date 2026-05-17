'use client';
import { AuditResult } from '@/lib/sinveneno-core-engine';

interface ResultCardProps {
  result: AuditResult;
  productName?: string;
  onReset: () => void;
  onSave?: () => void;
}

const STATUS_CONFIG = {
  GREEN: {
    emoji: '🟢',
    label: 'LIMPIO',
    bg: 'bg-green-950 border-green-700',
    text: 'text-green-400',
    badge: 'bg-green-900 text-green-300',
  },
  YELLOW: {
    emoji: '🟡',
    label: 'PRECAUCIÓN',
    bg: 'bg-yellow-950 border-yellow-700',
    text: 'text-yellow-400',
    badge: 'bg-yellow-900 text-yellow-300',
  },
  RED: {
    emoji: '🔴',
    label: 'EVITAR',
    bg: 'bg-red-950 border-red-800',
    text: 'text-red-400',
    badge: 'bg-red-900 text-red-300',
  },
  UNKNOWN: {
    emoji: '⚪',
    label: 'DESCONOCIDO',
    bg: 'bg-neutral-900 border-neutral-700',
    text: 'text-neutral-400',
    badge: 'bg-neutral-800 text-neutral-300',
  },
};

const LAYER_LABEL: Record<string, string> = {
  CAPA_1_ACEITES: 'Aceites de semillas',
  CAPA_2_METALES: 'Metales pesados (inferencia)',
  CAPA_3_PLASTICOS: 'Migración química de empaque',
  NINGUNA: 'Ninguna',
  TIMEOUT: 'Timeout de seguridad',
};

export default function ResultCard({ result, productName, onReset, onSave }: ResultCardProps) {
  const cfg = STATUS_CONFIG[result.status] || STATUS_CONFIG.UNKNOWN;

  return (
    <div className={`w-full max-w-md mx-auto rounded-2xl border-2 ${cfg.bg} p-6 space-y-4`}>
      {/* Product name */}
      {productName && (
        <p className="text-neutral-400 text-sm uppercase tracking-widest truncate">{productName}</p>
      )}

      {/* Divider */}
      <div className="border-b border-neutral-800" />

      {/* Status badge */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">{cfg.emoji}</span>
        <span className={`text-2xl font-black tracking-widest ${cfg.text}`}>{cfg.label}</span>
      </div>

      {/* Divider */}
      <div className="border-b border-neutral-800" />

      {/* Reason */}
      <div className="space-y-3">
        {result.triggeredTokens.length > 0 && result.triggeredTokens.map((token, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-start gap-2">
              <span className="text-lg mt-0.5">⚠️</span>
              <span className={`font-semibold capitalize ${cfg.text}`}>{token.split('(')[0]}</span>
            </div>
            {i === 0 && (
              <p className="text-neutral-400 text-sm ml-7 leading-snug">{result.reason}</p>
            )}
          </div>
        ))}
        {result.triggeredTokens.length === 0 && (
          <p className="text-neutral-300 text-sm leading-relaxed">{result.reason}</p>
        )}
      </div>

      {/* Metal score */}
      {result.metalScore !== undefined && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-neutral-500">Score metales:</span>
          <span className={`font-bold ${cfg.text}`}>{result.metalScore}/100</span>
        </div>
      )}

      {/* Divider */}
      <div className="border-b border-neutral-800" />

      {/* Meta */}
      <div className="space-y-1 text-xs text-neutral-600">
        <p>Capa disparada: <span className="text-neutral-400">{LAYER_LABEL[result.layerTriggered] || result.layerTriggered}</span></p>
        <p>Tiempo análisis: <span className="text-neutral-400">{result.executionTimeMs}ms</span></p>
      </div>

      {/* Divider */}
      <div className="border-b border-neutral-800" />

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onReset}
          className="flex-1 flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          📷 Analizar otro
        </button>
        {onSave && (
          <button
            onClick={onSave}
            className="flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold py-3 px-4 rounded-xl transition-colors text-sm"
          >
            💾
          </button>
        )}
      </div>
    </div>
  );
}
