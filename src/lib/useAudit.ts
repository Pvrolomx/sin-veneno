'use client';
import { useCallback, useState } from 'react';
import { ScanInput, AuditResult, auditProduct } from '@/lib/sinveneno-core-engine';

export function useAudit() {
  const [isRunning, setIsRunning] = useState(false);

  const runAudit = useCallback((input: ScanInput): Promise<AuditResult> => {
    setIsRunning(true);
    return new Promise((resolve) => {
      try {
        // Motor es sub-10ms — no bloquea UI en práctica
        const result = auditProduct(input);
        setIsRunning(false);
        resolve(result);
      } catch {
        setIsRunning(false);
        resolve({
          status: 'RED',
          layerTriggered: 'TIMEOUT',
          reason: 'Error en motor de análisis. Bloqueado por seguridad.',
          triggeredTokens: [],
          executionTimeMs: 0,
        });
      }
    });
  }, []);

  return { runAudit, isRunning };
}
