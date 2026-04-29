"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchRhDirectoryMerged } from "@/lib/rh/merge-directory";
import type { RhColaboradorDirectoryItem } from "@/lib/rh/types";
import { fatigueLevel, fatigueScore, mockWeeklyHours, rjtProxy } from "@/lib/rh/fatigue";
import { FatigueGauge } from "@/components/rh/fatigue-gauge";
import { RhCard } from "@/components/rh/rh-card";
import { hashSeed } from "@/lib/rh/hash";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

export default function RhJornadaPage() {
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [rows, setRows] = useState<RhColaboradorDirectoryItem[]>([]);

  useEffect(() => {
    void fetchRhDirectoryMerged().then(setRows);
  }, []);

  const byTurno = useMemo(() => {
    const m = { MANHÃ: 0, TARDE: 0, NOITE: 0, outro: 0 };
    for (const r of rows) {
      const t = String(r.turno).toUpperCase();
      if (t.includes("MANH")) m["MANHÃ"]++;
      else if (t.includes("TARD")) m["TARDE"]++;
      else if (t.includes("NOIT")) m["NOITE"]++;
      else m.outro++;
    }
    return m;
  }, [rows]);

  if (!allowed) return <p className="text-amber-400">Acesso restrito.</p>;

  const sample = rows[0];
  const wh = sample ? mockWeeklyHours(sample.id) : 40;
  const sc = fatigueScore({
    lastShiftHours: 7 + (sample ? hashSeed(sample.id) % 6 : 0),
    hoursSinceRest: 9 + (sample ? hashSeed(sample.id) % 8 : 0),
    weeklyAccumulated: wh,
    interventionsPerHour: 2.5 + (sample ? (hashSeed(sample.id) % 5) * 0.2 : 0),
  });
  const lvl = fatigueLevel(sc);
  const rjt = sample ? rjtProxy(sample.id, sample.operacoes24h ?? 0, wh) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Jornada e fadiga</h1>
          <p className="text-sm text-zinc-500">Indicadores calculados integralmente no front.</p>
        </div>
        <Link href="/rh/jornada/ponto" className="text-sm text-cyan-400 hover:underline">
          Abrir ponto mobile →
        </Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <RhCard title="Operadores por turno">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between border-b border-white/5 py-1">
              <span className="text-zinc-400">MANHÃ</span>
              <span className="font-mono text-cyan-300">{byTurno["MANHÃ"]}</span>
            </li>
            <li className="flex justify-between border-b border-white/5 py-1">
              <span className="text-zinc-400">TARDE</span>
              <span className="font-mono text-cyan-300">{byTurno["TARDE"]}</span>
            </li>
            <li className="flex justify-between border-b border-white/5 py-1">
              <span className="text-zinc-400">NOITE</span>
              <span className="font-mono text-cyan-300">{byTurno["NOITE"]}</span>
            </li>
            <li className="flex justify-between py-1">
              <span className="text-zinc-400">Outros / indef.</span>
              <span className="font-mono text-zinc-500">{byTurno.outro}</span>
            </li>
          </ul>
        </RhCard>
        <RhCard title="Horas (proxy 7 dias úteis)" subtitle="Sem persistência">
          <p className="text-3xl font-bold text-amber-200">{wh}h</p>
          <p className="mt-2 text-xs text-zinc-500">Baseado em seed + perfil; integre ponto digital local na próxima etapa.</p>
        </RhCard>
        <RhCard title="RJT · risco jornada/turno">
          <p className="text-3xl font-bold text-red-300">{rjt}</p>
          <p className="mt-2 text-xs text-zinc-500">Combina volume 24h e extrapolação de jornada.</p>
        </RhCard>
      </div>
      <RhCard title="Fatigue index (amostra)" subtitle={sample ? sample.nome : "—"}>
        <FatigueGauge score={sc} level={lvl} />
      </RhCard>
      <RhCard title="Indisponibilidade" subtitle="Regra local 11h entre jornadas como alvo">
        <p className="text-sm text-zinc-400">
          Descanso mínimo de <span className="text-amber-200">11h</span> pós turno · alertas visuais na escala semanal.
        </p>
      </RhCard>
    </div>
  );
}
