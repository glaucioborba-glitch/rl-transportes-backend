"use client";

import { useEffect, useState } from "react";
import { ControleEntradaSaidaFotoZoom } from "@/components/gate/controle-entrada-saida-foto-zoom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string | null;
  mime: string;
  titulo: string;
};

export function PixComprovanteDialog({ open, onOpenChange, src, mime, titulo }: Props) {
  const pdf = mime.toLowerCase().includes("pdf");

  return (
    <Dialog open={open && Boolean(src)} onOpenChange={onOpenChange}>
      <DialogContent className={pdf ? "max-h-[95vh] max-w-4xl" : "max-w-3xl"}>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        {src ? (
          pdf ? (
            <iframe title={titulo} src={src} className="h-[80vh] w-full rounded-md bg-white" />
          ) : (
            <ControleEntradaSaidaFotoZoom src={src} alt={titulo} />
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function useBlobObjectUrl(blob: Blob | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}
