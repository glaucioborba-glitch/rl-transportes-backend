"use client";

import { useCallback, useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CertificateUploader({ label }: { label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  const onFile = useCallback((file: File | null) => {
    if (!file) return;
    setName(file.name);
    const u = URL.createObjectURL(file);
    setUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return u;
    });
  }, []);

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4">
      <p className="text-xs font-semibold text-zinc-300">{label}</p>
      <p className="mt-1 text-[11px] leading-snug text-zinc-500">
        Upload apenas local (base URL no navegador). Nada é enviado ao servidor.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="cursor-pointer">
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
          <span className="inline-flex rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200">
            Selecionar PDF
          </span>
        </label>
        {name ? (
          <span className="flex items-center gap-1 text-[11px] text-zinc-400">
            <FileText className="h-4 w-4" />
            {name}
          </span>
        ) : null}
      </div>
      {url ? (
        <Button type="button" variant="outline" className="mt-3 border-zinc-600 text-zinc-200" asChild>
          <a href={url} target="_blank" rel="noreferrer">
            Visualizar PDF
          </a>
        </Button>
      ) : null}
    </div>
  );
}
