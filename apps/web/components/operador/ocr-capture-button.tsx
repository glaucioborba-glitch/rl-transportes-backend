"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, staffRequest } from "@/lib/api/staff-client";
import { Camera } from "lucide-react";

export type OcrGateResult = {
  placa?: string | null;
  placaValidaMercosul?: boolean;
  numeroIso?: string | null;
  numeroIsoValido6346?: boolean;
  confiancaLeitura?: number;
};

type Props = {
  label: string;
  onResult: (r: OcrGateResult) => void;
  disabled?: boolean;
};

/** Foto → multipart POST /ia/ocr/gate/upload */
export function OCRCaptureButton({ label, onResult, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(f: File | null) {
    if (!f) return;
    setErr(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("imagem", f);
      const res = await staffRequest("/ia/ocr/gate/upload", { method: "POST", body: fd });
      const text = await res.text();
      if (!res.ok) throw new ApiError(text || "OCR falhou", res.status);
      const json = JSON.parse(text) as OcrGateResult;
      onResult(json);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Falha no OCR");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
      />
      <Button
        type="button"
        variant="outline"
        disabled={disabled || loading}
        className="min-h-12 w-full gap-2 border-white/20 bg-black/30 text-white hover:bg-white/10"
        onClick={() => inputRef.current?.click()}
      >
        <Camera className="h-5 w-5" />
        {loading ? "Lendo…" : label}
      </Button>
      {err ? <p className="text-xs text-red-400">{err}</p> : null}
    </div>
  );
}
