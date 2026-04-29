"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchRhDirectoryMerged } from "@/lib/rh/merge-directory";
import { RhCard } from "@/components/rh/rh-card";
import { ScheduleMatrix, type ScheduleCell } from "@/components/rh/schedule-matrix";
import { rhEscalaKey, readJson, writeJson } from "@/lib/rh/storage";
import { hashSeed } from "@/lib/rh/hash";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

type EscalaStore = {
  matrix: Record<string, ScheduleCell[]>;
  logs: { at: string; operador: string; programado: string; executado: string }[];
};

const DEFAULT: EscalaStore = {
  matrix: {
    A: [
      { group: "A", turno: "MANHÃ", fixed: true },
      { group: "A", turno: "MANHÃ" },
      { group: "A", turno: "MANHÃ" },
      { group: "A", turno: "TARDE" },
      { group: "A", turno: "TARDE" },
      { group: "A", turno: "—" },
      { group: "A", turno: "—" },
    ],
    B: [
      { group: "B", turno: "TARDE" },
      { group: "B", turno: "TARDE" },
      { group: "B", turno: "NOITE" },
      { group: "B", turno: "NOITE" },
      { group: "B", turno: "MANHÃ" },
      { group: "B", turno: "MANHÃ" },
      { group: "B", turno: "—" },
    ],
    C: [
      { group: "C", turno: "NOITE" },
      { group: "C", turno: "NOITE" },
      { group: "C", turno: "TARDE" },
      { group: "C", turno: "MANHÃ" },
      { group: "C", turno: "MANHÃ" },
      { group: "C", turno: "NOITE" },
      { group: "C", turno: "NOITE" },
    ],
  },
  logs: [],
};

export default function RhJornadaEscalaPage() {
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [store, setStore] = useState<EscalaStore>(DEFAULT);
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    setStore(readJson(rhEscalaKey(), DEFAULT));
    void fetchRhDirectoryMerged().then((r) => setNames(r.slice(0, 8).map((x) => x.nome)));
  }, []);

  useEffect(() => {
    writeJson(rhEscalaKey(), store);
  }, [store]);

  const logs = useMemo(() => store.logs.slice(-12).reverse(), [store.logs]);

  if (!allowed) return <p className="text-amber-400">Acesso restrito.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Escala semanal</h1>
        <p className="text-sm text-zinc-500">
          Grupos A/B/C · regras Lei 6.019 (11h) exibidas como texto · persistência somente no navegador.
        </p>
      </div>
      <RhCard title="Matriz semanal" subtitle="SEG–DOM · edite células (demo)">
        <ScheduleMatrix data={store.matrix} />
        <p className="mt-3 text-xs text-zinc-500">
          Jornada padrão 8h; modo 12×36 pode ser refletido trocando rótulos para &quot;12h plantão&quot; manualmente.
        </p>
        <button
          type="button"
          className="mt-3 rounded-lg border border-cyan-500/40 px-3 py-2 text-xs font-semibold text-cyan-200"
          onClick={() => {
            const operador = names[hashSeed(String(Date.now())) % Math.max(1, names.length)] ?? "Operador";
            setStore((s) => ({
              ...s,
              logs: [
                ...s.logs,
                {
                  at: new Date().toISOString(),
                  operador,
                  programado: "MANHÃ",
                  executado: hashSeed(operador + Date.now()) % 2 === 0 ? "MANHÃ" : "TARDE",
                },
              ],
            }));
          }}
        >
          Simular marcação executada (log local)
        </button>
      </RhCard>
      <RhCard title="Operador → programado vs executado">
        {logs.length === 0 ? (
          <p className="text-sm text-zinc-500">Sem logs ainda.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {logs.map((l, i) => (
              <li key={i} className="rounded-md border border-white/5 bg-zinc-900/50 px-3 py-2">
                <span className="text-xs text-zinc-500">{l.at}</span> · {l.operador}: prog.{" "}
                <span className="text-cyan-300">{l.programado}</span> / exec.{" "}
                <span className={l.programado === l.executado ? "text-emerald-400" : "text-amber-300"}>{l.executado}</span>
              </li>
            ))}
          </ul>
        )}
      </RhCard>
    </div>
  );
}
