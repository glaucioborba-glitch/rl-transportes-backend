"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchRhDirectoryMerged } from "@/lib/rh/merge-directory";
import { RhCard } from "@/components/rh/rh-card";
import { CompetencyMatrix } from "@/components/rh/competency-matrix";
import { CertificateUploader } from "@/components/rh/certificate-uploader";
import {
  RH_COMPETENCY_LABELS,
  competencyMatrixForUser,
  elegibilidadeOperacionalLabel,
  mockNrPack,
  trainingCoursesCatalog,
} from "@/lib/rh/nr-skills-mock";
import type { RhColaboradorDirectoryItem, RhCompetencyId } from "@/lib/rh/types";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { NrBadge } from "@/components/rh/nr-badge";

export default function RhCompetenciasPage() {
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [rows, setRows] = useState<RhColaboradorDirectoryItem[]>([]);

  useEffect(() => {
    void fetchRhDirectoryMerged().then(setRows);
  }, []);

  const alerts = useMemo(() => {
    const expiring: string[] = [];
    const notFit: string[] = [];
    for (const r of rows) {
      const nr = mockNrPack(r.id, { admin: r.role === "ADMIN" || r.role === "GERENTE" });
      const matrix = competencyMatrixForUser(r.id, r.role);
      const el = elegibilidadeOperacionalLabel({ matrix, nr, status: r.status });
      if (el === "NÃO APTO") notFit.push(r.nome);
      for (const x of nr) {
        const d = new Date(x.validade);
        if (Number.isFinite(d.getTime())) {
          const days = (d.getTime() - Date.now()) / 864e5;
          if (days >= 0 && days < 30 && x.status !== "válido") expiring.push(`${r.nome}: ${x.code}`);
        }
      }
    }
    return { expiring: expiring.slice(0, 12), notFit: notFit.slice(0, 12) };
  }, [rows]);

  if (!allowed) return <p className="text-amber-400">Acesso restrito.</p>;

  const catalog = trainingCoursesCatalog();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Competências & treinamentos</h1>
        <p className="text-sm text-zinc-500">Matriz auditável · certificados locais · elegibilidade cruzada.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <RhCard title="Alertas · vencimento &lt; 30d" subtitle="Heurística local">
          {alerts.expiring.length === 0 ? (
            <p className="text-sm text-emerald-400/90">Nenhum alerta amostrado.</p>
          ) : (
            <ul className="list-inside list-disc text-sm text-amber-100">
              {alerts.expiring.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          )}
        </RhCard>
        <RhCard title="Operadores não aptos (proxy)">
          {alerts.notFit.length === 0 ? (
            <p className="text-sm text-emerald-400/90">Nenhum colaborador na lista vermelha simulada.</p>
          ) : (
            <ul className="list-inside list-disc text-sm text-red-200">
              {alerts.notFit.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          )}
        </RhCard>
      </div>
      <RhCard title="1) Matriz de competências" subtitle="Linhas = colaboradores">
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-500">Carregando…</p>
        ) : (
          <CompetencyMatrix rows={rows.filter((r) => !r.id.startsWith("folha-")).slice(0, 20)} />
        )}
      </RhCard>
      <RhCard title="2) Treinamentos obrigatórios (NR)" subtitle="Somente referência + upload local">
        <div className="grid gap-4 md:grid-cols-2">
          {catalog.map((c) => (
            <div key={c.code} className="rounded-xl border border-white/10 bg-zinc-900/40 p-4">
              <p className="font-semibold text-zinc-200">
                {c.code} — {c.nome}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Carga {c.cargaHoraria}h · validade {c.validadeMeses} meses · {c.instituicao}
              </p>
              <div className="mt-3">
                <CertificateUploader label={`Certificado ${c.code}`} />
              </div>
            </div>
          ))}
        </div>
      </RhCard>
      <RhCard title="3) Elegibilidade (Gate / Pátio / RS)" subtitle="Cruce com perfil + NR + matriz">
        <div className="overflow-x-auto">
          <table className="min-w-[640px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-zinc-500">
                <th className="py-2">Nome</th>
                {(Object.keys(RH_COMPETENCY_LABELS) as RhCompetencyId[]).slice(0, 4).map((k) => (
                  <th key={k} className="py-2">
                    {RH_COMPETENCY_LABELS[k]}
                  </th>
                ))}
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((r) => {
                const m = competencyMatrixForUser(r.id, r.role);
                const nr = mockNrPack(r.id);
                const el = elegibilidadeOperacionalLabel({ matrix: m, nr, status: r.status });
                return (
                  <tr key={r.id} className="border-b border-white/5">
                    <td className="py-2">
                      <Link href={`/rh/competencias/${encodeURIComponent(r.id)}`} className="text-cyan-400 hover:underline">
                        {r.nome}
                      </Link>
                    </td>
                    {(["gate", "patio", "empilhadeira", "seg_operacional"] as const).map((k) => (
                      <td key={k} className="py-2 text-xs text-zinc-400">
                        {m[k]}
                      </td>
                    ))}
                    <td className="py-2">
                      <span
                        className={
                          el === "APTO"
                            ? "text-emerald-400"
                            : el === "EM RECICLAGEM"
                              ? "text-amber-300"
                              : "text-red-300"
                        }
                      >
                        {el}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </RhCard>
      <RhCard title="4) Risco operacional (capacitação)" subtitle="Percentual de NR críticas no conjunto exibido">
        <p className="text-3xl font-bold text-red-300">
          {rows.length
            ? Math.round(
                (rows.filter((r) => mockNrPack(r.id).some((n) => n.status === "vencido")).length / rows.length) * 100,
              )
            : 0}
          %
        </p>
        <p className="text-xs text-zinc-500">Denominador = amostra carregada, não necessariamente todo o terminal.</p>
      </RhCard>
      <RhCard title="NR resumo (amostra operadores)">
        <div className="flex flex-wrap gap-2">
          {mockNrPack(rows[0]?.id ?? "demo").map((n) => (
            <div key={n.code} className="rounded-lg border border-white/10 bg-zinc-900/50 px-2 py-1 text-xs">
              <span className="text-zinc-300">{n.code}</span> · <NrBadge status={n.status} />
            </div>
          ))}
        </div>
      </RhCard>
    </div>
  );
}
