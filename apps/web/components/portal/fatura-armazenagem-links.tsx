"use client";

import { ExternalLink, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import type { FaturaArmazenagemPortal } from "@/lib/api/portal-client";

type Props = {
  fatura: Pick<FaturaArmazenagemPortal, "linkNfse" | "linkBoleto" | "linkPix">;
  compact?: boolean;
};

function copyText(label: string, value: string) {
  void navigator.clipboard.writeText(value);
  toast.success(`${label} copiado`);
}

export function FaturaArmazenagemLinks({ fatura, compact }: Props) {
  const { linkNfse, linkBoleto, linkPix } = fatura;
  const hasAny = !!(linkNfse || linkBoleto || linkPix);

  if (!hasAny) {
    return (
      <p className="text-sm text-slate-500">
        Documentos ainda não disponíveis. Aguarde o processamento da NFS-e e do boleto.
      </p>
    );
  }

  const btnSize = compact ? ("sm" as const) : ("default" as const);

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "" : "pt-1"}`}>
      {linkNfse ? (
        <Button variant="outline" size={btnSize} asChild>
          <a href={linkNfse} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            NFS-e (PDF)
          </a>
        </Button>
      ) : null}
      {linkBoleto ? (
        <Button variant="outline" size={btnSize} asChild>
          <a href={linkBoleto} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Boleto
          </a>
        </Button>
      ) : null}
      {linkPix ? (
        <>
          {linkPix.startsWith("http") ? (
            <Button variant="outline" size={btnSize} asChild>
              <a href={linkPix} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                QR Code PIX
              </a>
            </Button>
          ) : null}
          <Button type="button" variant="outline" size={btnSize} onClick={() => copyText("PIX", linkPix)}>
            <Copy className="mr-2 h-4 w-4" />
            Copiar PIX
          </Button>
        </>
      ) : null}
    </div>
  );
}
