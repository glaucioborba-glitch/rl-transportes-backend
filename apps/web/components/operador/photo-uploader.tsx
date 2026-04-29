"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, X } from "lucide-react";

export type PhotoEntry = { id: string; dataUrl: string; name: string };

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("leitura"));
    r.readAsDataURL(file);
  });
}

type Props = {
  label: string;
  photos: PhotoEntry[];
  onChange: (p: PhotoEntry[]) => void;
  max?: number;
};

export function PhotoUploader({ label, photos, onChange, max = 8 }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const next = [...photos];
    for (const f of Array.from(files)) {
      if (next.length >= max) break;
      const dataUrl = await fileToDataUrl(f);
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        dataUrl,
        name: f.name,
      });
    }
    onChange(next);
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-200">{label}</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-10"
          disabled={photos.length >= max}
          onClick={() => ref.current?.click()}
        >
          <ImagePlus className="h-4 w-4" />
          Adicionar
        </Button>
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={(e) => void addFiles(e.target.files)}
      />
      <div className="flex flex-wrap gap-2">
        {photos.map((p) => (
          <div key={p.id} className="relative h-20 w-28 overflow-hidden rounded-lg border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.dataUrl} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              className="absolute right-1 top-1 rounded bg-black/70 p-1 text-white"
              onClick={() => onChange(photos.filter((x) => x.id !== p.id))}
              aria-label="Remover"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
