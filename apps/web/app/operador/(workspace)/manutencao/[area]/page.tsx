"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MANUTENCAO_HUB_HREF, manutencaoAreaById } from "@/lib/manutencao/manutencao-menu";

export default function ManutencaoAreaPage() {
  const params = useParams<{ area: string }>();
  const area = manutencaoAreaById(params.area ?? "");

  if (!area) {
    return (
      <main className="mx-auto flex min-h-full max-w-lg flex-col gap-4 px-4 py-8">
        <p className="text-sm text-slate-400">Essa área não existe neste menu.</p>
        <Link href={MANUTENCAO_HUB_HREF} className="text-sm font-bold text-cyan-400">
          ← Voltar à Manutenção
        </Link>
      </main>
    );
  }

  const Icon = area.icon;

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-6 px-4 py-6">
      <Link
        href={MANUTENCAO_HUB_HREF}
        className="inline-flex items-center gap-2 self-start text-sm text-slate-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Manutenção
      </Link>

      <div className={`relative overflow-hidden rounded-2xl border p-6 pl-7 ${area.accent}`}>
        <span className={`absolute inset-y-0 left-0 w-1.5 ${area.bar}`} />
        <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${area.iconBg}`}>
          <Icon className="h-7 w-7" />
        </span>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold text-white">{area.label}</h1>
          <span className="rounded-full border border-white/15 bg-black/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-200">
            Somente visual
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-200">{area.preview}</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0c0f14] px-5 py-8 text-center">
        <p className="text-base font-semibold text-white">Ainda sem lançamento</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
          O menu já está no tablet e na intranet. Quando ligarmos esta tela, o operador registra
          aqui — sem misturar com o cadastro de equipamentos.
        </p>
      </div>
    </main>
  );
}
