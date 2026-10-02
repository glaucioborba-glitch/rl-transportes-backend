"use client";

import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const ATIVAS = [
  "Criar solicitações",
  "Agendar turno",
  "Gerar PDF",
  "Anexar documentos",
  "Alterar dados no gate",
] as const;

const INATIVAS = ["Visualizar financeiro", "Gerenciar pessoas", "Aprovar OS"] as const;

/** Painel read-only das permissões fixas de transportadoras terceirizadas. */
export function TransportadoraPermissoesPanel({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4 rounded-lg border border-white/10 bg-zinc-950/40 p-4", className)}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        <Lock className="h-3.5 w-3.5" />
        Permissões fixas (somente leitura)
      </div>
      <p className="text-xs text-slate-500">
        Transportadoras operam em nome do cliente principal. O faturamento permanece 100% com o
        tenant titular.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold text-cyan-300/90">Permitido</p>
          <ul className="space-y-2">
            {ATIVAS.map((label) => (
              <li key={label} className="flex items-center gap-2 text-sm text-slate-200">
                <Check className="h-4 w-4 shrink-0 text-cyan-400" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-500">Bloqueado</p>
          <ul className="space-y-2">
            {INATIVAS.map((label) => (
              <li key={label} className="flex items-center gap-2 text-sm text-slate-500">
                <span className="inline-block h-4 w-4 shrink-0 rounded border border-slate-600 bg-slate-800/80" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
