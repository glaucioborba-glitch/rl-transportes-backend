"use client";

import { useRef } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { compressVistoriaPhoto } from "@/lib/image-compress-vistoria";

type PortariaPhotoButtonProps = {
  label: string;
  captured: boolean;
  onCapture: (dataUrl: string) => void;
  disabled?: boolean;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("leitura"));
    r.readAsDataURL(file);
  });
}

export function PortariaPhotoButton({
  label,
  captured,
  onCapture,
  disabled,
}: PortariaPhotoButtonProps) {
  const ref = useRef<HTMLInputElement>(null);

  async function onFile(file: File | null) {
    if (!file) return;
    const compressed = await compressVistoriaPhoto(file);
    const dataUrl = await fileToDataUrl(compressed);
    onCapture(dataUrl);
  }

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
      />
      <Button
        type="button"
        variant={captured ? "default" : "outline"}
        className="min-h-12 w-full justify-start gap-2"
        disabled={disabled}
        onClick={() => ref.current?.click()}
      >
        <Camera className="h-5 w-5 shrink-0" />
        <span>{captured ? `${label} ✓` : label}</span>
      </Button>
    </>
  );
}
