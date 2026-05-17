import { auditProduct, ScanInput } from '@/lib/sinveneno-core-engine';

self.onmessage = (e: MessageEvent<ScanInput>) => {
  const result = auditProduct(e.data);
  self.postMessage(result);
};
