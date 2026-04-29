"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { staffJson } from "@/lib/api/staff-client";
import { fetchRhColaboradorById } from "@/lib/rh/merge-directory";
import { mockNrPack, mockOperacionalProfile } from "@/lib/rh/nr-skills-mock";
import type { RhColaboradorDirectoryItem } from "@/lib/rh/types";
import { NrBadge } from "@/components/rh/nr-badge";
import { RhCard } from "@/components/rh/rh-card";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { toast } from "@/lib/toast";
import { rhUserOverridesKey, readJson, writeJson } from "@/lib/rh/storage";

type AuditRow = {
  id: string;
  tabela: string;
  registroId: string;
  acao: string;
  createdAt: string;
  dadosAntes?: unknown;
  dadosDepois?: unknown;
};

export default function RhColaboradorDetailPage() {
  const params = useParams();
  const idRaw = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [row, setRow] = useState<RhColaboradorDirectoryItem | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [turnoEdit, setTurnoEdit] = useState("MANHÃ");
  const [situacaoEdit, setSituacaoEdit] = useState<"ativo" | "desligado" | "afastado">("ativo");

  const load = useCallback(async () => {
    if (!idRaw) return;
    const r = await fetchRhColaboradorById(decodeURIComponent(idRaw));
    setRow(r);
    if (r) {
      setTurnoEdit(String(r.turno).toUpperCase().includes("MANH") ? "MANHÃ" : String(r.turno).toUpperCase().includes("TARD") ? "TARDE" : "NOITE");
      setSituacaoEdit(r.status);
    }
    try {
      const res = await staffJson<{ data: AuditRow[] }>(
        `/auditoria?tabela=users&registroId=${encodeURIComponent(idRaw)}&limit=40`,
      );
      setAudit(res.data ?? []);
    } catch {
      setAudit([]);
    }
  }, [idRaw]);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePatch() {
    if (!idRaw || !row) return;
    const body = { turno: turnoEdit, situacao: situacaoEdit };
    try {
      await staffJson(`/users/${encodeURIComponent(idRaw)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      toast.success("Registro atualizado no servidor.");
      await load();
    } catch {
      const key = rhUserOverridesKey(idRaw);
      const prev = readJson<Record<string, unknown>>(key, {});
      writeJson(key, { ...prev, ...body, savedAt: new Date().toISOString() });
      toast.message("PATCH /users indisponível — preferências salvas só no navegador.");
    }
  }

  if (!allowed) return <p className="text-amber-400">Acesso restrito.</p>;
  if (!row) {
    return (
      <div className="space-y-4">
        <Link href="/rh/colaboradores" className="text-sm text-cyan-400 hover:underline">
          ← Voltar
        </Link>
        <p className="text-zinc-400">Colaborador não encontrado.</p>
      </div>
    );
  }

  const nr = mockNrPack(row.id, { admin: row.role === "ADMIN" || row.role === "GERENTE" });
  const op = mockOperacionalProfile(row.id, row.role);
  const isStaff = row.role === "ADMIN" || row.role === "GERENTE";

  const prod24 = row.operacoes24h;

  return (
    <div className="space-y-6">
      <Link href="/rh/colaboradores" className="text-sm text-cyan-400 hover:underline">
        ← Colaboradores
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-white">{row.nome}</h1>
        <p className="text-sm text-zinc-500">
          {row.email} · {row.role} · fonte: {row.source}
        </p>
      </div>

      <RhCard title="A) Dados pessoais">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-zinc-500">CPF (somente leitura)</p>
            <p className="font-mono text-zinc-200">{row.cpf ? maskCpf(row.cpf) : "Não disponível na API"}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Email</p>
            <p className="text-zinc-200">{row.email ?? "—"}</p>
          </div>
          <label className="text-xs text-zinc-500">
            Turno alocado
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-sm"
              value={turnoEdit}
              onChange={(e) => setTurnoEdit(e.target.value)}
            >
              <option>MANHÃ</option>
              <option>TARDE</option>
              <option>NOITE</option>
            </select>
          </label>
          <label className="text-xs text-zinc-500">
            Situação
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-sm"
              value={situacaoEdit}
              onChange={(e) => setSituacaoEdit(e.target.value as "ativo" | "desligado" | "afastado")}
            >
              <option value="ativo">ativo</option>
              <option value="desligado">desligado</option>
              <option value="afastado">afastado</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          className="mt-4 rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-100 ring-1 ring-cyan-500/40"
          onClick={() => void savePatch()}
        >
          Salvar (PATCH /users ou local)
        </button>
      </RhCard>

      <RhCard title="B) Perfil operacional">
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-zinc-500">Habilitação pátio</dt>
            <dd className={op.patio ? "text-emerald-400" : "text-zinc-400"}>{op.patio ? "Sim" : "Não"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Habilitação portaria</dt>
            <dd className={op.portaria ? "text-emerald-400" : "text-zinc-400"}>{op.portaria ? "Sim" : "Não"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Habilitação gate</dt>
            <dd className={op.gate ? "text-emerald-400" : "text-zinc-400"}>{op.gate ? "Sim" : "Não"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Escolaridade</dt>
            <dd className="text-zinc-200">{op.escolaridade}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">CBO / Cargo</dt>
            <dd className="text-zinc-200">{row.cargo ?? op.cboCargo}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Tempo de casa</dt>
            <dd className="text-zinc-200">{op.tempoCasaMeses} meses</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Último treinamento (proxy)</dt>
            <dd className="text-zinc-200">{op.ultimoTreinamento}</dd>
          </div>
        </dl>
      </RhCard>

      <RhCard title="C) NR-Compliance" subtitle="Checklist local — PDF apenas visualização">
        <div className="space-y-3">
          {nr.map((n) => (
            <div
              key={n.code}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-zinc-900/50 px-3 py-2"
            >
              <div>
                <p className="font-semibold text-zinc-200">
                  {n.code} — {n.label}
                </p>
                <p className="text-xs text-zinc-500">
                  Validade {n.validade} · {n.instituicao}
                </p>
              </div>
              <NrBadge status={n.status} />
            </div>
          ))}
        </div>
      </RhCard>

      {isStaff ? (
        <RhCard
          title="D) Produtividade individual (staff)"
          subtitle="KPI principal: operacoes24h do dashboard (sem filtro por operador nas solicitações)"
        >
          <ul className="text-sm text-zinc-300 space-y-1">
            <li>
              Operações 24h: <span className="font-mono text-cyan-300">{prod24 ?? "—"}</span>
            </li>
            <li>Média por turno (estimada local): {(prod24 ?? 0) / 3}</li>
            <li>Pico (proxy seed): {Math.max(1, (prod24 ?? 1) + 3)}</li>
          </ul>
        </RhCard>
      ) : (
        <RhCard title="D) Produtividade" subtitle="Reservado a perfis de supervisão (ADMIN/GERENTE)">
          <p className="text-sm text-zinc-500">Operadores veem apenas compliance e jornada.</p>
        </RhCard>
      )}

      <RhCard title="E) Auditoria RH" subtitle="GET /auditoria?tabela=users">
        {audit.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum evento indexado para este registro.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {audit.map((a) => (
              <li key={a.id} className="rounded-md border border-white/5 bg-zinc-900/40 px-3 py-2">
                <span className="text-zinc-500 text-xs">{a.createdAt}</span> ·{" "}
                <span className="text-cyan-300">{a.acao}</span>
              </li>
            ))}
          </ul>
        )}
      </RhCard>
    </div>
  );
}

function maskCpf(cpf: string) {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return "•••.•••.•••-••";
  return `${d.slice(0, 3)}.***.***-${d.slice(9)}`;
}
