"use client";

import { useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";
import { compressVistoriaPhoto } from "@/lib/image-compress-vistoria";
import type { VistoriaAngulo } from "@/lib/gate-vistoria";

type GateVistoriaPhotoSlotProps = {
  angulo: VistoriaAngulo;
  label: string;
  hint: string;
  file?: File;
  onCapture: (file: File) => void;
};

export function GateVistoriaPhotoSlot({
  angulo,
  label,
  hint,
  file,
  onCapture,
}: GateVistoriaPhotoSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    e.target.value = "";
    if (!raw) return;
    setCompressing(true);
    try {
      const compressed = await compressVistoriaPhoto(raw);
      setPreview(URL.createObjectURL(compressed));
      onCapture(compressed);
    } finally {
      setCompressing(false);
    }
  }

  const done = Boolean(file);
  const showPreview = preview;

  return (
    <div
      className={
        done
          ? "rounded-2xl border-2 border-emerald-400 bg-emerald-950/40 p-3"
          : "rounded-2xl border-2 border-dashed border-white/20 bg-black/50 p-3"
      }
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-base font-bold text-white">{label}</p>
          <p className="text-xs text-zinc-500">{hint}</p>
        </div>
        {done ? <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-400" /> : null}
      </div>

      {showPreview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={showPreview} alt={label} className="mb-3 h-32 w-full rounded-lg object-cover" />
      ) : (
        <div className="mb-3 flex h-32 items-center justify-center rounded-lg bg-black/60 text-zinc-600">
          <Camera className="h-10 w-10" />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        data-testid={`photo-${angulo}`}
        className="sr-only"
        id={`vistoria-${angulo}`}
        onChange={(e) => void onFileChange(e)}
      />
      <label
        htmlFor={`vistoria-${angulo}`}
        className={
          done
            ? "flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-emerald-600 text-center text-sm font-bold text-white"
            : "flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-cyan-500 text-center text-sm font-bold text-black"
        }
      >
        {compressing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Comprimindo…
          </>
        ) : done ? (
          "Refazer foto"
        ) : (
          "Capturar foto"
        )}
      </label>
    </div>
  );
}
