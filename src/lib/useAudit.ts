'use client';
import { useRef, useCallback, useState } from 'react';
import { ScanInput, AuditResult } from '@/lib/sinveneno-core-engine';

export function useAudit() {
  const workerRef = useRef<Worker | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/sinveneno.worker.ts', import.meta.url),
        { type: 'module' }
      );
    }
    return workerRef.current;
  }, []);

  const runAudit = useCallback((input: ScanInput): Promise<AuditResult> => {
    setIsRunning(true);
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        setIsRunning(false);
        resolve({
          status: 'RED',
          layerTriggered: 'TIMEOUT',
          reason: 'Análisis superó 2.8s. Bloqueado por seguridad.',
          triggeredTokens: [],
          executionTimeMs: 2800,
        });
      }, 2800);

      const worker = getWorker();
      worker.onmessage = (e: MessageEvent<AuditResult>) => {
        clearTimeout(timeoutId);
        setIsRunning(false);
        resolve(e.data);
      };
      worker.onerror = () => {
        clearTimeout(timeoutId);
        setIsRunning(false);
        resolve({
          status: 'RED',
          layerTriggered: 'TIMEOUT',
          reason: 'Error en motor de análisis. Bloqueado por seguridad.',
          triggeredTokens: [],
          executionTimeMs: 0,
        });
      };
      worker.postMessage(input);
    });
  }, [getWorker]);

  return { runAudit, isRunning };
}
