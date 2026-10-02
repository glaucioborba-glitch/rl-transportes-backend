"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadBlob, imprimirDocumento, nomeArquivoDocumento } from "@/lib/documento-saida";
import {
  PRINT_AGENT_PRINTER_KEY,
  preferirImpressora,
  probePrintAgent,
  type PrintAgentPrinter,
} from "@/lib/print-agent-client";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export type DocumentoSaidaPedido = {
  titulo: string;
  descricao?: string;
  filename: string;
  obter: () => Promise<Blob>;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedido: DocumentoSaidaPedido | null;
};

export function DocumentoSaidaDialog({ open, onOpenChange, pedido }: Props) {
  const [busy, setBusy] = useState<"download" | "impressao" | null>(null);
  const [agentOk, setAgentOk] = useState<boolean | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [printers, setPrinters] = useState<PrintAgentPrinter[]>([]);
  const [printer, setPrinter] = useState("");
  const [sumatra, setSumatra] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const health = await probePrintAgent();
      if (cancelled) return;
      setAgentOk(health.ok);
      setAgentError(health.error ?? null);
      setSumatra(Boolean(health.sumatra));
      setPrinters(health.printers.filter((p) => !p.virtual));
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(PRINT_AGENT_PRINTER_KEY);
      } catch {
        saved = null;
      }
      setPrinter(preferirImpressora(health.printers, saved));
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function executar(acao: "download" | "impressao") {
    if (!pedido || busy) return;
    setBusy(acao);
    const destino = printer;
    try {
      const blob = await pedido.obter();
      if (acao === "download") {
        downloadBlob(blob, nomeArquivoDocumento(pedido.filename, blob));
        toast.success("Download iniciado.");
        onOpenChange(false);
        return;
      }
      onOpenChange(false);
      setBusy(null);
      await imprimirDocumento(blob, destino || undefined);
      toast.success(destino ? `Enviado para ${destino}.` : "Enviado para a impressora.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o documento.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setBusy(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="z-[70] max-w-md">
        <DialogHeader>
          <DialogTitle>{pedido?.titulo ?? "Documento"}</DialogTitle>
          <DialogDescription>
            {pedido?.descricao ?? "Escolha se deseja baixar o arquivo ou enviar direto para a impressora."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={!pedido || Boolean(busy)}
            onClick={() => void executar("download")}
            className={cn(
              "flex flex-col items-start rounded-xl border border-white/15 bg-white/5 p-4 text-left transition-colors",
              "hover:border-primary/40 hover:bg-white/10 disabled:opacity-60",
            )}
          >
            {busy === "download" ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            ) : (
              <Download className="h-6 w-6 text-primary" />
            )}
            <span className="mt-3 text-base font-semibold text-white">Download</span>
            <span className="mt-1 text-xs text-slate-400">Salva o arquivo no computador.</span>
          </button>
          <button
            type="button"
            disabled={!pedido || Boolean(busy) || agentOk === false || !sumatra || !printer}
            onClick={() => void executar("impressao")}
            className={cn(
              "flex flex-col items-start rounded-xl border border-white/15 bg-white/5 p-4 text-left transition-colors",
              "hover:border-primary/40 hover:bg-white/10 disabled:opacity-60",
            )}
          >
            {busy === "impressao" ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            ) : (
              <Printer className="h-6 w-6 text-primary" />
            )}
            <span className="mt-3 text-base font-semibold text-white">Impressão</span>
            <span className="mt-1 text-xs text-slate-400">
              Envia ao agente local, sem passar pelo Chrome.
            </span>
          </button>
        </div>
        {agentOk === false ? (
          <p className="text-xs text-amber-300">
            {agentError ?? "Rode npm run print-agent neste PC e abra esta caixa de novo."}
          </p>
        ) : null}
        {agentOk && !sumatra ? (
          <p className="text-xs text-amber-300">
            Instale o SumatraPDF (gratuito) neste PC: https://www.sumatrapdfreader.org — sem ele a
            Epson não recebe o cupom.
          </p>
        ) : null}
        {agentOk && sumatra && printers.length === 0 ? (
          <p className="text-xs text-amber-300">
            Nenhuma impressora física. Instale o driver da Epson TM-T20X neste computador.
          </p>
        ) : null}
        {agentOk && printers.length > 0 ? (
          <label className="block text-xs text-slate-400">
            Impressora
            <select
              value={printer}
              disabled={Boolean(busy)}
              onChange={(e) => setPrinter(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            >
              {printers.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                  {p.default ? " (padrão)" : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Padrão para qualquer modelo imprimível: `pedir({ titulo, filename, obter })` e renderizar `dialog`. */
export function useDocumentoSaida() {
  const [pedido, setPedido] = useState<DocumentoSaidaPedido | null>(null);
  return {
    pedir: (next: DocumentoSaidaPedido) => setPedido(next),
    dialog: (
      <DocumentoSaidaDialog
        open={Boolean(pedido)}
        onOpenChange={(open) => {
          if (!open) setPedido(null);
        }}
        pedido={pedido}
      />
    ),
  };
}
