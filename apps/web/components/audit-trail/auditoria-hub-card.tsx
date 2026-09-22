"use client";

import Link from "next/link";
import {
  CLASSIFICACAO_AUDITORIA,
  hrefAuditoriaGerencial,
  type ClassificacaoAuditoria,
} from "@/lib/auditoria/classificacao-auditoria";
import { cn } from "@/lib/utils";

export function AuditoriaHubCard({
  titulo = "Auditoria gerencial",
  descricao = "A trilha unificada da intranet fica no menu Auditoria: verdes (rotina), amarelas (dado já gravado) e vermelhas (senha, fluxo ou faturamento).",
  q,
}: {
  titulo?: string;
  descricao?: string;
  q?: string;
}) {
  const classes = Object.keys(CLASSIFICACAO_AUDITORIA) as ClassificacaoAuditoria[];
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950/50 p-4">
      <p className="text-sm font-semibold text-white">{titulo}</p>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{descricao}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={hrefAuditoriaGerencial({ q })}
          className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20"
        >
          Abrir trilha completa
        </Link>
        {classes.map((id) => {
          const meta = CLASSIFICACAO_AUDITORIA[id];
          return (
            <Link
              key={id}
              href={hrefAuditoriaGerencial({ q, classificacao: id })}
              className={cn("rounded-lg border px-3 py-1.5 text-xs font-semibold", meta.className)}
            >
              {meta.titulo}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
