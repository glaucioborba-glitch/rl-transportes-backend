"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { ApiError, motoristaFormData } from "@/lib/api/motorista-client";
import { MobileButton } from "./mobile-button";

export type OcrGateResult = {
  placa?: string | null;
  placaValidaMercosul?: boolean;
  numeroIso?: string | null;
  numeroIsoValido6346?: boolean;
  confiancaLeitura?: number;
};

export function OcrCaptureMobile({
  label,
  onResult,
  disabled,
}: {
  label: string;
  onResult: (r: OcrGateResult) => void;
  disabled?: boolean;
}) {
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
      const res = await motoristaFormData("/ia/ocr/gate/upload", fd);
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
      <MobileButton
        type="button"
        variant="outline"
        className="border-white/20 bg-black/30 text-white hover:bg-white/10"
        disabled={disabled || loading}
        onClick={() => inputRef.current?.click()}
      >
        <Camera className="h-5 w-5" />
        {loading ? "Lendo…" : label}
      </MobileButton>
      {err ? <p className="text-xs text-red-400">{err}</p> : null}
    </div>
  );
}
