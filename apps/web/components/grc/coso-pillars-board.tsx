"use client";

import { cn } from "@/lib/utils";

const PILLARS = [
  {
    id: "env",
    title: "Ambiente de controle",
    desc: "Tomada, integridade, estrutura e accountability (COSO ICIF).",
    accent: "from-indigo-900/40 to-slate-900/80",
  },
  {
    id: "risk",
    title: "Avaliação de riscos",
    desc: "Objetivos, variabilidade e critérios ERM 2023.",
    accent: "from-violet-900/35 to-slate-900/80",
  },
  {
    id: "act",
    title: "Atividades de controle",
    desc: "Políticas e procedimentos mitigadores SOX-light.",
    accent: "from-blue-900/40 to-slate-900/80",
  },
  {
    id: "info",
    title: "Informação & comunicação",
    desc: "Fluxos internos e trilhas de auditoria digitais.",
    accent: "from-cyan-900/30 to-slate-900/80",
  },
  {
    id: "mon",
    title: "Monitoramento",
    desc: "Ongoing e separadas — indicadores e retestes.",
    accent: "from-fuchsia-900/30 to-slate-900/80",
  },
] as const;

export function CosoPillarsBoard() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {PILLARS.map((p, i) => (
        <div
          key={p.id}
          className={cn(
            "relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br p-4 shadow-lg",
            p.accent,
          )}
        >
          <span className="absolute right-3 top-3 font-mono text-3xl font-bold text-white/10">{i + 1}</span>
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-300/90">{p.title}</p>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">{p.desc}</p>
        </div>
      ))}
    </div>
  );
}
