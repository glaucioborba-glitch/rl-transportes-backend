"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { RiskTreatmentType } from "@/lib/grc/types";
import { grcRiskRegister, grcSetTreatments, grcTreatments } from "@/lib/grc/storage";
import { cn } from "@/lib/utils";

const STRATEGIES: { v: RiskTreatmentType; l: string; hint: string }[] = [
  { v: "tolerar", l: "Tolerar", hint: "Dentro do apetite; monitorar." },
  { v: "tratar", l: "Tratar", hint: "Planos de redução / controles." },
  { v: "transferir", l: "Transferir", hint: "Seguro, contrato, terceiro." },
  { v: "terminar", l: "Terminar", hint: "Eliminar processo ou exposição." },
];

export function RiskTreatmentBoard() {
  const [rows, setRows] = useState(() => grcTreatments());
  const [riskId, setRiskId] = useState("");
  const [strategy, setStrategy] = useState<RiskTreatmentType>("tratar");
  const [nota, setNota] = useState("");
  const risks = grcRiskRegister();
  const effectiveRiskId = riskId || risks[0]?.id || "";

  function persist(next: typeof rows) {
    setRows(next);
    grcSetTreatments(next);
  }

  function add() {
    if (!effectiveRiskId) return;
    persist([
      ...rows,
      {
        id: crypto.randomUUID(),
        riscoId: effectiveRiskId,
        strategy,
        nota: nota.trim() || "—",
      },
    ]);
    setNota("");
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl border border-white/10 bg-zinc-950/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {STRATEGIES.map((s) => (
          <div key={s.v} className="rounded-lg border border-white/5 bg-black/30 p-3">
            <p className="text-xs font-bold uppercase text-red-300/90">{s.l}</p>
            <p className="mt-1 text-[10px] text-zinc-500">{s.hint}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-white/10 p-4">
        <label className="min-w-[160px] text-[10px] text-zinc-500">
          Risco (registro local)
          <select
            className="mt-1 w-full rounded border border-white/10 bg-zinc-900 px-2 py-2 text-xs"
            value={riskId || risks[0]?.id || ""}
            onChange={(e) => setRiskId(e.target.value)}
          >
            {risks.length === 0 ? <option value="">— cadastre na matriz acima —</option> : null}
            {risks.map((r) => (
              <option key={r.id} value={r.id}>
                {r.risco.slice(0, 48)}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[120px] text-[10px] text-zinc-500">
          Estratégia (4Ts)
          <select
            className="mt-1 w-full rounded border border-white/10 bg-zinc-900 px-2 py-2 text-xs"
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as RiskTreatmentType)}
          >
            {STRATEGIES.map((s) => (
              <option key={s.v} value={s.v}>
                {s.l}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[200px] flex-1 text-[10px] text-zinc-500">
          Plano resumido
          <input
            className="mt-1 w-full rounded border border-white/10 bg-zinc-900 px-2 py-2 text-xs"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ação, responsável, prazo…"
          />
        </label>
        <Button type="button" size="sm" className="bg-red-950/80 hover:bg-red-900" onClick={add}>
          Registrar plano
        </Button>
      </div>
      <div className="max-h-56 overflow-auto rounded-xl border border-white/10">
        <table className="w-full text-left text-[11px]">
          <thead className="sticky top-0 bg-[#060814] text-zinc-500">
            <tr>
              <th className="p-2">Risco</th>
              <th className="p-2">4T</th>
              <th className="p-2">Plano</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-zinc-600">
                  Nenhum tratamento registrado (somente navegador).
                </td>
              </tr>
            ) : (
              rows.map((t) => {
                const rk = risks.find((r) => r.id === t.riscoId);
                return (
                  <tr key={t.id} className="border-t border-white/5">
                    <td className="p-2 text-zinc-300">{rk?.risco ?? t.riscoId}</td>
                    <td className="p-2">
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                          t.strategy === "tolerar" && "bg-zinc-800 text-zinc-300",
                          t.strategy === "tratar" && "bg-amber-900/50 text-amber-100",
                          t.strategy === "transferir" && "bg-indigo-900/50 text-indigo-100",
                          t.strategy === "terminar" && "bg-red-950/60 text-red-200",
                        )}
                      >
                        {t.strategy}
                      </span>
                    </td>
                    <td className="p-2 text-zinc-500">{t.nota}</td>
                    <td className="p-2">
                      <button type="button" className="text-[10px] text-rose-400 hover:underline" onClick={() => persist(rows.filter((x) => x.id !== t.id))}>
                        Remover
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
