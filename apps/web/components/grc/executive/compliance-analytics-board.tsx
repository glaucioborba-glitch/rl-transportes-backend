"use client";

import type { ClientStressRow } from "@/lib/grc/executive-kpis";
import { cn } from "@/lib/utils";

export function ComplianceAnalyticsBoard({
  integrityScore,
  violacoes,
  ranking,
}: {
  integrityScore: number;
  violacoes: {
    isoDuplicado: number;
    gatesSemPortaria: number;
    saidasSemGateOuPatio: number;
    tentativas403PorEscopo: number;
    statusInconsistentes: number;
  };
  ranking: ClientStressRow[];
}) {
  const rows = [
    { k: "ISO duplicado (solicitações ativas)", v: violacoes.isoDuplicado },
    { k: "Gate sem portaria", v: violacoes.gatesSemPortaria },
    { k: "Saída sem etapa intermediária (gate/pátio)", v: violacoes.saidasSemGateOuPatio },
    { k: "Tentativas fora de escopo (403 / SEGURANCA)", v: violacoes.tentativas403PorEscopo },
    { k: "Status inconsistentes / fluxo incompleto", v: violacoes.statusInconsistentes },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="xl:col-span-5 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300/80">Violações · leitura em tempo real</p>
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-[#050814] text-zinc-500">
              <tr>
                <th className="p-3">Indicador</th>
                <th className="p-3 text-right">Qtde</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.k} className="border-t border-white/5">
                  <td className="p-3 text-zinc-400">{r.k}</td>
                  <td className={cn("p-3 text-right font-mono font-bold", r.v > 0 ? "text-amber-200" : "text-emerald-300/90")}>{r.v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-2xl border border-cyan-500/25 bg-cyan-950/15 px-4 py-4">
          <p className="text-[10px] font-bold uppercase text-cyan-300/90">Pontuação de integridade operacional</p>
          <p className="mt-2 font-mono text-4xl font-light text-white">{integrityScore}</p>
          <p className="mt-2 text-xs text-zinc-500">Agregação ponderada de violações de fluxo, escopo, estadia e saturação (heurística front).</p>
        </div>
      </div>
      <div className="xl:col-span-7 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300/80">Ranking de criticidade por cliente</p>
        <p className="text-[11px] text-zinc-500">Score composto a partir de <code className="text-zinc-600">/comercial/recomendacoes</code> e volume no período (dashboard).</p>
        <div className="max-h-[380px] overflow-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 z-[1] bg-[#060812] text-zinc-500">
              <tr>
                <th className="p-3">Cliente</th>
                <th className="p-3">Prioridade máx.</th>
                <th className="p-3 text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {ranking.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-zinc-600">
                    Sem alertas por cliente no período.
                  </td>
                </tr>
              ) : (
                ranking.map((r) => (
                  <tr key={r.clienteId} className="border-t border-white/5">
                    <td className="p-3">
                      <p className="font-medium text-zinc-200">{r.clienteNome}</p>
                      {r.motivos.length ? (
                        <ul className="mt-1 max-w-xl list-inside list-disc text-[10px] text-zinc-600">
                          {r.motivos.map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                    <td className="p-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                          r.prioridadeMax === "alta" && "bg-red-950/60 text-red-200",
                          r.prioridadeMax === "media" && "bg-amber-950/50 text-amber-100",
                          (r.prioridadeMax === "baixa" || r.prioridadeMax === "—") && "bg-zinc-800 text-zinc-300",
                        )}
                      >
                        {r.prioridadeMax}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono text-zinc-200">{r.score}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
