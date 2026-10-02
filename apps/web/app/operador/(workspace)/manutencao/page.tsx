"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MANUTENCAO_AREAS } from "@/lib/manutencao/manutencao-menu";

export default function ManutencaoHubPage() {
  return (
    <main className="mx-auto flex min-h-full max-w-4xl flex-col gap-6 px-4 py-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">Oficina</p>
        <h1 className="mt-1 text-3xl font-bold text-white">Manutenção</h1>
        <p className="mt-2 max-w-xl text-sm text-slate-400">
          Abastecimento, máquinas da empresa e oficina — no desktop e no tablet. As telas abaixo
          já mostram o menu; a operação entra na próxima etapa.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {MANUTENCAO_AREAS.map((area) => {
          const Icon = area.icon;
          return (
            <Link
              key={area.id}
              href={area.href}
              className={`group relative min-h-[9.5rem] overflow-hidden rounded-2xl border p-5 pl-6 ${area.accent}`}
            >
              <span className={`absolute inset-y-0 left-0 w-1.5 ${area.bar}`} />
              <div className="flex items-start justify-between gap-3">
                <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${area.iconBg}`}>
                  <Icon className="h-6 w-6" />
                </span>
                <span className="rounded-full border border-white/15 bg-black/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                  Em breve
                </span>
              </div>
              <h2 className="mt-4 text-xl font-bold text-white">{area.label}</h2>
              <p className="mt-1 text-sm leading-snug text-slate-300">{area.detalhe}</p>
              <ChevronRight className="absolute bottom-5 right-4 h-5 w-5 text-white/40 transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
            </Link>
          );
        })}
      </div>
    </main>
  );
}
