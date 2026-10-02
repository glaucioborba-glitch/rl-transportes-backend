"use client";

import { useState } from "react";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { intentLabel } from "@/lib/solicitacao-intent";
import type { TipoOperacaoSolicitacaoIntent } from "@/lib/api/portal-client";
import { GateAgendamentoRapidoParticularForm } from "./gate-agendamento-rapido-particular-form";

const PARTICULAR_INTENTS: Array<{
  value: "SOLICITAR_BAIXA" | "SOLICITAR_COLETA";
  help: string;
  icon: typeof ArrowDownCircle;
}> = [
  {
    value: "SOLICITAR_BAIXA",
    help: "Cliente chega agora com a unidade (entrada).",
    icon: ArrowDownCircle,
  },
  {
    value: "SOLICITAR_COLETA",
    help: "Cliente retira agora uma unidade que já está no pátio.",
    icon: ArrowUpCircle,
  },
];

export default function GateAgendamentoRapidoParticularPage() {
  const [intent, setIntent] = useState<TipoOperacaoSolicitacaoIntent | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Agendamento Rápido Particular</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastro rápido: CPF, nome e telefone. Sem NFS-e. A operação é agora — sem data nem turno
          para escolher. Pagamento sempre à vista (PIX ou dinheiro).
        </p>
      </div>

      {!intent ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {PARTICULAR_INTENTS.map((op) => {
            const Icon = op.icon;
            return (
              <button
                key={op.value}
                type="button"
                onClick={() => setIntent(op.value)}
                className="rounded-xl border border-white/10 bg-[#0b1018]/80 p-5 text-left transition hover:border-white/25 hover:bg-white/[0.03]"
              >
                <div className="mb-2 flex items-center gap-2 text-white">
                  <Icon className="h-5 w-5 text-sky-300" />
                  <span className="font-semibold">{intentLabel(op.value)}</span>
                </div>
                <p className="text-sm text-zinc-400">{op.help}</p>
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
          <GateAgendamentoRapidoParticularForm intent={intent} onCancel={() => setIntent(null)} />
        </div>
      )}
    </div>
  );
}
