"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { fetchRhDirectoryMerged } from "@/lib/rh/merge-directory";
import { mockNrPack, summarizeNrCompliance } from "@/lib/rh/nr-skills-mock";
import type { RhColaboradorDirectoryItem } from "@/lib/rh/types";
import { RhCard } from "@/components/rh/rh-card";
import { hashSeed } from "@/lib/rh/hash";

export default function RhDashboardPage() {
  const [rows, setRows] = useState<RhColaboradorDirectoryItem[]>([]);
  const [relTotal, setRelTotal] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const [dir, ini, fim] = await Promise.all([
          fetchRhDirectoryMerged(),
          Promise.resolve(new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)),
          Promise.resolve(new Date().toISOString().slice(0, 10)),
        ]);
        if (!on) return;
        setRows(dir);
        try {
          const sol = await staffJson<{
            meta?: { total: number };
            items?: unknown[];
          }>(`/relatorios/operacional/solicitacoes?dataInicio=${ini}&dataFim=${fim}&page=1&limit=5`);
          if (!on) return;
          setRelTotal(sol.meta?.total ?? sol.items?.length ?? null);
        } catch {
          setRelTotal(null);
        }
      } catch (e) {
        if (!on) return;
        setErr(e instanceof ApiError ? e.message : "Erro ao carregar RH");
      }
    })();
    return () => {
      on = false;
    };
  }, []);

  const kpi = useMemo(() => {
    let risco = 0;
    let conformes = 0;
    for (const r of rows) {
      const nr = mockNrPack(r.id, { admin: r.role === "ADMIN" || r.role === "GERENTE" });
      const s = summarizeNrCompliance(nr);
      if (s === "Crítico") risco += 1;
      else if (s === "Conforme") conformes += 1;
    }
    const prod = rows.reduce((a, r) => a + (r.operacoes24h ?? 0), 0);
    return { risco, conformes, prod, headcount: rows.length };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Painel RH / DP</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          Produtividade (proxy dashboard), risco por NR-simulação local e conformidade agregada. Os registros de colaborador
          combinam <code className="text-cyan-400">/users</code> (quando existir), <code className="text-cyan-400">/dashboard</code>{" "}
          e <code className="text-cyan-400">/folha/colaboradores</code> sem alterações no backend.
        </p>
      </div>
      {err ? <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{err}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RhCard title="Headcount interno" subtitle="Cadastro unificado (front)">
          <p className="text-3xl font-bold text-cyan-300 tabular-nums">{kpi.headcount}</p>
        </RhCard>
        <RhCard title="Ops 24h (Σ operadores)" subtitle="Filas / dashboard">
          <p className="text-3xl font-bold text-emerald-300 tabular-nums">{kpi.prod}</p>
        </RhCard>
        <RhCard title="Conformidade NR (proxy)" subtitle="Verde = pacote sem vencido">
          <p className="text-3xl font-bold text-emerald-200 tabular-nums">{kpi.conformes}</p>
          <p className="mt-1 text-xs text-zinc-500">{kpi.headcount ? `${Math.round((kpi.conformes / kpi.headcount) * 100)}% aproximado` : "—"}</p>
        </RhCard>
        <RhCard title='Perfil "crítico"' subtitle="NR mock com item vencido">
          <p className="text-3xl font-bold text-red-300 tabular-nums">{kpi.risco}</p>
        </RhCard>
      </div>
      <RhCard title="Contexto comercial (7 dias)" subtitle="GET /relatorios/operacional/solicitacoes">
        <p className="text-sm text-zinc-300">
          Volume auditável no período:{" "}
          <span className="font-mono text-cyan-300">{relTotal !== null ? relTotal : "—"}</span> solicitações (total paginado).
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Não há filtro por operador na API; use a seção de produtividade do colaborador apenas como proxy cruzando{" "}
          <code className="text-zinc-400">operacoes24h</code> do dashboard.
        </p>
      </RhCard>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/rh/colaboradores"
          className="rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 px-4 py-3 text-sm font-bold text-zinc-950"
        >
          Abrir cadastro
        </Link>
        <Link href="/rh/jornada" className="rounded-xl border border-cyan-500/40 px-4 py-3 text-sm font-semibold text-cyan-200">
          Jornada e fadiga
        </Link>
        <Link href="/rh/competencias" className="rounded-xl border border-white/15 px-4 py-3 text-sm text-zinc-300">
          Competências
        </Link>
      </div>
      <RhCard title="Alertas determinísticos (seed)" subtitle="Ilustração UX — não persistido">
        <ul className="list-inside list-disc text-sm text-zinc-400">
          {rows.slice(0, 5).map((r) => (
            <li key={r.id}>
              <span className="text-zinc-200">{r.nome}</span> — índice fadiga proxy {hashSeed(r.id) % 100}
            </li>
          ))}
        </ul>
      </RhCard>
    </div>
  );
}
