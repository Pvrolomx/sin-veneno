'use client';
import { useEffect, useRef, useState } from 'react';

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const detectedRef = useRef(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('Iniciando cámara...');

  useEffect(() => {
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play();
        setCameraActive(true);
        setHint('Apunta al código de barras');

        // Try native BarcodeDetector first (Chrome Android, Edge)
        if ('BarcodeDetector' in window) {
          const detector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
          });

          intervalRef.current = setInterval(async () => {
            if (detectedRef.current || !video) return;
            try {
              const codes = await detector.detect(video);
              if (codes.length > 0) {
                const val = codes[0].rawValue;
                if (val) {
                  detectedRef.current = true;
                  cleanup();
                  onDetected(val);
                }
              }
            } catch { /* frame not ready */ }
          }, 250);

        } else {
          // Fallback: canvas frame capture → send to /api/scan for barcode parsing
          // Show manual capture button
          setHint('Toca "Capturar" cuando el código esté centrado');
        }
      } catch {
        setError('No se pudo acceder a la cámara. Cierra y usa "Fotografiar etiqueta".');
        setHint('');
      }
    };

    const cleanup = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };

    start();
    return () => cleanup();
  }, [onDetected]);

  // Manual capture for browsers without BarcodeDetector
  const handleManualCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      setHint('Procesando...');
      try {
        // Send frame to Claude Vision to extract barcode number
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];
          const res = await fetch('/api/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'barcode_vision',
              imageBase64: base64,
              imageMediaType: 'image/jpeg',
            }),
          }).then(r => r.json());

          if (res.barcode) {
            streamRef.current?.getTracks().forEach(t => t.stop());
            onDetected(res.barcode);
          } else {
            setHint('No se detectó código. Intenta de nuevo.');
          }
        };
        reader.readAsDataURL(blob);
      } catch {
        setHint('Error. Intenta de nuevo.');
      }
    }, 'image/jpeg', 0.95);
  };

  const hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pt-8">
        <span className="text-white font-semibold text-lg">Código de barras</span>
        <button onClick={onClose} className="text-neutral-400 text-3xl leading-none px-2">✕</button>
      </div>

      {/* Camera view */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {/* Viewfinder */}
        {cameraActive && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-80 h-44">
              {/* Dimmed areas */}
              <div className="absolute inset-0 rounded-xl" style={{ boxShadow: '0 0 0 1000px rgba(0,0,0,0.55)' }} />
              {/* Corner markers */}
              {[
                'top-0 left-0 border-t-4 border-l-4 rounded-tl-xl',
                'top-0 right-0 border-t-4 border-r-4 rounded-tr-xl',
                'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl',
                'bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl',
              ].map((cls, i) => (
                <div key={i} className={`absolute w-8 h-8 border-green-400 ${cls}`} />
              ))}
              {/* Scan line — only when auto-detecting */}
              {hasBarcodeDetector && (
                <div className="absolute left-2 right-2 h-0.5 bg-green-400 opacity-75 top-1/2 animate-pulse" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Bottom area */}
      <div className="pb-10 pt-4 px-6 flex flex-col items-center gap-4">
        {error ? (
          <p className="text-red-400 text-sm text-center">{error}</p>
        ) : (
          <p className="text-neutral-400 text-sm text-center">{hint}</p>
        )}

        {/* Manual capture button — shown when no native BarcodeDetector */}
        {cameraActive && !hasBarcodeDetector && !error && (
          <button
            onClick={handleManualCapture}
            className="bg-green-700 hover:bg-green-600 active:bg-green-800 text-white font-bold py-4 px-10 rounded-2xl text-lg transition-colors"
          >
            📸 Capturar
          </button>
        )}

        {hasBarcodeDetector && cameraActive && (
          <p className="text-neutral-600 text-xs">Detección automática activa</p>
        )}
      </div>
    </div>
  );
}
