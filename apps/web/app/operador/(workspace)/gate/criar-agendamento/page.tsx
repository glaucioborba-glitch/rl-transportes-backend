"use client";

import { useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Ship } from "lucide-react";
import { SOLICITACAO_INTENT_OPTIONS, intentLabel } from "@/lib/solicitacao-intent";
import type { TipoOperacaoSolicitacaoIntent } from "@/lib/api/portal-client";
import { GateCriarAgendamentoForm } from "./gate-criar-agendamento-form";

const INTENT_HELP: Record<TipoOperacaoSolicitacaoIntent, string> = {
  SOLICITAR_BAIXA: "Cliente traz a unidade ao terminal (entrada).",
  SOLICITAR_IMPORTACAO_COLETA_DEPOT: "Frota RL busca a unidade na origem / porto.",
  SOLICITAR_COLETA: "Cliente retira uma unidade que já está no pátio.",
  SOLICITAR_EXPORTACAO_ENTREGA_DEPOT: "Frota RL entrega a unidade no destino / porto.",
};

const INTENT_ICON: Record<TipoOperacaoSolicitacaoIntent, typeof ArrowDownCircle> = {
  SOLICITAR_BAIXA: ArrowDownCircle,
  SOLICITAR_IMPORTACAO_COLETA_DEPOT: Ship,
  SOLICITAR_COLETA: ArrowUpCircle,
  SOLICITAR_EXPORTACAO_ENTREGA_DEPOT: Ship,
};

export default function GateCriarAgendamentoPage() {
  const [intent, setIntent] = useState<TipoOperacaoSolicitacaoIntent | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Criar agendamento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mesmas solicitações do portal do cliente, com preenchimento manual.
        </p>
      </div>

      {!intent ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {SOLICITACAO_INTENT_OPTIONS.map((op) => {
            const Icon = INTENT_ICON[op.value];
            return (
              <button
                key={op.value}
                type="button"
                onClick={() => setIntent(op.value)}
                className="rounded-xl border border-white/10 bg-[#0b1018]/80 p-5 text-left transition hover:border-white/25 hover:bg-white/[0.03]"
              >
                <div className="mb-2 flex items-center gap-2 text-white">
                  <Icon className="h-5 w-5 text-sky-300" />
                  <span className="font-semibold">{op.label}</span>
                </div>
                <p className="text-sm text-zinc-400">{INTENT_HELP[op.value]}</p>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{intentLabel(intent)}</h2>
            <button
              type="button"
              className="text-sm text-zinc-400 hover:text-white"
              onClick={() => setIntent(null)}
            >
              Trocar tipo
            </button>
          </div>
          <GateCriarAgendamentoForm intent={intent} onCancel={() => setIntent(null)} />
        </div>
      )}
    </div>
  );
}
