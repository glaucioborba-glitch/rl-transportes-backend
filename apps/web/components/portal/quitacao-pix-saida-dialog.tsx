"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  cotarPixSaidaSolicitacao,
  type CotacaoPixSaida,
  type TipoOperacaoSolicitacaoIntent,
} from "@/lib/api/portal-client";
import { formatMoneyBrl } from "@/lib/armazenagem-pre-fatura";
import { isSolicitacaoSaidaIntent } from "@/lib/solicitacao-intent";
import { toast } from "@/lib/toast";

export function useQuitacaoPixSaidaDialog() {
  const [quote, setQuote] = useState<CotacaoPixSaida | null>(null);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const pendingCreate = useRef<(() => Promise<void>) | null>(null);

  async function runWithQuitacao(args: {
    tipoOperacao: TipoOperacaoSolicitacaoIntent;
    unidades: string[];
    create: () => Promise<void>;
  }) {
    if (!isSolicitacaoSaidaIntent(args.tipoOperacao)) {
      await args.create();
      return;
    }
    const q = await cotarPixSaidaSolicitacao({
      tipoOperacao: args.tipoOperacao,
      unidades: args.unidades,
    });
    if (!q.exigido) {
      await args.create();
      return;
    }
    pendingCreate.current = args.create;
    setQuote(q);
    setOpen(true);
  }

  async function confirm() {
    if (!quote?.suficiente) return;
    const fn = pendingCreate.current;
    if (!fn) return;
    setConfirming(true);
    try {
      await fn();
      pendingCreate.current = null;
      setOpen(false);
      setQuote(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Falha ao quitar e salvar a solicitação.";
      toast.error(msg);
    } finally {
      setConfirming(false);
    }
  }

  function dismiss() {
    if (confirming) return;
    pendingCreate.current = null;
    setOpen(false);
    setQuote(null);
  }

  return { quote, open, confirming, runWithQuitacao, confirm, dismiss };
}

export function QuitacaoPixSaidaDialog(props: {
  open: boolean;
  quote: CotacaoPixSaida | null;
  confirming: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const { open, quote, confirming, onConfirm, onDismiss } = props;
  if (!open || !quote || typeof document === "undefined") return null;

  const suficiente = quote.suficiente;
  const falta = Math.max(0, Math.round((quote.valor - quote.saldo) * 100) / 100);

  return createPortal(
    <div
      className="fixed inset-0 z-[310] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quitacao-pix-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1419] p-6 shadow-2xl">
        <h2 id="quitacao-pix-title" className="text-lg font-semibold text-white">
          {suficiente ? "Quitação PIX desta solicitação" : "Saldo insuficiente na conta comercial"}
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          {suficiente
            ? "Cliente PIX quita o valor do ID no momento da solicitação, usando o saldo da conta comercial."
            : "A conta comercial não pode ficar negativa. Recarregue via PIX e tente novamente."}
        </p>

        <dl className="mt-4 space-y-2 rounded-xl border border-white/10 bg-black/30 p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Saldo atual</dt>
            <dd className="font-medium text-white">{formatMoneyBrl(quote.saldo)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Valor a descontar</dt>
            <dd className="font-medium text-amber-200">{formatMoneyBrl(quote.valor)}</dd>
          </div>
          {quote.ids.length > 1
            ? quote.ids.map((id) => (
                <div key={id.unidadeProcessoId} className="flex justify-between gap-4 pl-2 text-xs">
                  <dt className="text-slate-500">
                    {id.unidadeProcessoLabel} · {id.unidadeIso}
                  </dt>
                  <dd className="text-slate-300">{formatMoneyBrl(id.valor)}</dd>
                </div>
              ))
            : quote.ids[0]
              ? (
                  <div className="flex justify-between gap-4 text-xs">
                    <dt className="text-slate-500">
                      {quote.ids[0].unidadeProcessoLabel} · {quote.ids[0].unidadeIso}
                    </dt>
                    <dd className="text-slate-300">{formatMoneyBrl(quote.ids[0].valor)}</dd>
                  </div>
                )
              : null}
          <div className="flex justify-between gap-4 border-t border-white/10 pt-2">
            <dt className="text-slate-400">{suficiente ? "Saldo após quitação" : "Falta"}</dt>
            <dd className={suficiente ? "font-semibold text-emerald-300" : "font-semibold text-rose-300"}>
              {formatMoneyBrl(suficiente ? quote.saldoApos : falta)}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onDismiss} disabled={confirming}>
            {suficiente ? "Cancelar" : "Fechar"}
          </Button>
          {suficiente ? (
            <Button type="button" onClick={() => void onConfirm()} disabled={confirming}>
              {confirming ? "Quitando…" : "Confirmar quitação"}
            </Button>
          ) : (
            <Button type="button" asChild>
              <Link href="/portal/financeiro">Ir para a conta comercial</Link>
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
