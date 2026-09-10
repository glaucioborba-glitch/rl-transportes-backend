"use client";

import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type LogoUploadSpec = {
  titulo: string;
  ondeAparece: string;
  descricao: string;
  formatos: string;
  dimensoes: string;
  tamanhoMax: string;
};

type Props = {
  spec: LogoUploadSpec;
  previewUrl?: string | null;
  disabled?: boolean;
  accept?: string;
  onUpload: (file: File) => Promise<void>;
  onRemove?: () => Promise<void>;
};

export function LogoUploadCard({ spec, previewUrl, disabled, accept, onUpload, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file || disabled) return;
    setBusy(true);
    try {
      await onUpload(file);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{spec.titulo}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{spec.ondeAparece}</p>
        </div>
        {previewUrl ? (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
            Enviada
          </span>
        ) : (
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Padrão do sistema
          </span>
        )}
      </div>

      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void handleFile(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "mt-3 flex h-28 w-full items-center justify-center rounded-md border border-dashed bg-[#0b0d12] transition-colors",
          drag ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-white/10",
          disabled ? "cursor-not-allowed opacity-60" : "hover:border-white/25",
        )}
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={spec.titulo} className="max-h-24 max-w-[90%] object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
            <ImagePlus className="h-5 w-5" />
            Arraste ou clique para enviar
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept ?? "image/png,image/jpeg,image/webp,image/svg+xml"}
        className="hidden"
        disabled={disabled || busy}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      <dl className="mt-3 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
        <div>
          <dt className="inline font-medium text-slate-300">Formato: </dt>
          <dd className="inline">{spec.formatos}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-slate-300">Dimensões: </dt>
          <dd className="inline">{spec.dimensoes}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-slate-300">Tamanho: </dt>
          <dd className="inline">{spec.tamanhoMax}</dd>
        </div>
        <p>{spec.descricao}</p>
      </dl>

      {previewUrl && onRemove ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={disabled || busy}
          onClick={() => {
            setBusy(true);
            void onRemove().finally(() => setBusy(false));
          }}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Remover
        </Button>
      ) : null}
    </div>
  );
}
