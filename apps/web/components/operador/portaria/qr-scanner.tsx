"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { decodeQRPayload, isQRValid } from "@/lib/gate/qr-code";
import { parseQrCredencialPayload } from "@/lib/portaria/portaria-api";

type Props = {
  onScan: (protocolo: string) => void;
  onCancel: () => void;
};

export function QrScanner({ onScan, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const Detector = (
          window as Window & {
            BarcodeDetector?: new (o: { formats: string[] }) => {
              detect: (src: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
            };
          }
        ).BarcodeDetector;

        if (Detector && videoRef.current) {
          const detector = new Detector({ formats: ["qr_code"] });
          timerRef.current = window.setInterval(() => {
            const video = videoRef.current;
            if (!video || video.readyState < 2) return;
            void detector.detect(video).then((codes) => {
              const raw = codes[0]?.rawValue;
              if (!raw) return;
              handleRaw(raw);
            });
          }, 500);
        }
      } catch {
        if (!cancelled) setError("Não foi possível acessar a câmera. Verifique as permissões.");
      }
    }

    function handleRaw(raw: string) {
      const credencial = parseQrCredencialPayload(raw);
      if (credencial?.protocolo) {
        cleanup();
        onScan(credencial.protocolo);
        return;
      }
      const decoded = decodeQRPayload(raw);
      if (decoded && isQRValid(decoded)) {
        cleanup();
        onScan(decoded.protocolo);
      }
    }

    function cleanup() {
      if (timerRef.current) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    }

    void startCamera();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [onScan]);

  return (
    <div className="space-y-4">
      <div className="relative mx-auto aspect-square max-w-sm overflow-hidden rounded-xl bg-black">
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertCircle className="h-10 w-10 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
            <Button variant="outline" size="sm" onClick={() => setError("")}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-0 bg-black/50" />
              <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-primary" />
            </div>
            <div className="absolute bottom-4 left-0 right-0 text-center">
              <p className="inline-block rounded-full bg-black/60 px-4 py-1 text-sm text-white/90">
                Aponte para o QR Code do motorista
              </p>
            </div>
          </>
        )}
      </div>
      <Button variant="outline" className="w-full" onClick={onCancel}>
        <X className="mr-2 h-4 w-4" /> Cancelar
      </Button>
    </div>
  );
}
