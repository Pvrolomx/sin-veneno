'use client';
import { useEffect, useRef, useState } from 'react';

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let reader: any = null;
    let interval: NodeJS.Timeout;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setScanning(true);
        }

        // Lazy-load ZXing
        const { BrowserMultiFormatReader } = await import('@zxing/library');
        reader = new BrowserMultiFormatReader();

        interval = setInterval(async () => {
          if (!videoRef.current) return;
          try {
            const result = await reader.decodeFromVideoElement(videoRef.current);
            if (result) {
              clearInterval(interval);
              onDetected(result.getText());
            }
          } catch {
            // No code in frame — keep scanning
          }
        }, 300);
      } catch (e: any) {
        setError('No se pudo acceder a la cámara. Usa la foto manual.');
      }
    };

    startCamera();

    return () => {
      clearInterval(interval);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <span className="text-white font-semibold">Escanear código de barras</span>
        <button onClick={onClose} className="text-neutral-400 hover:text-white text-2xl">✕</button>
      </div>

      {/* Camera */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />

        {/* Viewfinder overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-72 h-40 border-2 border-green-400 rounded-xl relative">
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-400 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-400 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-400 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-400 rounded-br-lg" />
            {/* Scan line */}
            {scanning && (
              <div className="absolute left-1 right-1 h-0.5 bg-green-400 opacity-80 animate-bounce top-1/2" />
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950 text-red-300 text-sm text-center">{error}</div>
      )}
      <p className="text-neutral-500 text-xs text-center pb-6 pt-2">
        Apunta al código de barras — se detecta automáticamente
      </p>
    </div>
  );
}
