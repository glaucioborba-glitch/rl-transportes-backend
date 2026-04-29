"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { staffTryJson } from "@/lib/api/staff-client";
import { ssmaStorage } from "@/lib/ssma/storage";
import type { IncidentLocation, IncidentRecord, IncidentType, RiskLevel } from "@/lib/ssma/types";
import { toast } from "@/lib/toast";

const TIPOS: { v: IncidentType; l: string }[] = [
  { v: "quase_acidente", l: "Quase acidente" },
  { v: "acidente", l: "Acidente" },
  { v: "desvio", l: "Desvio" },
  { v: "critico", l: "Situação crítica" },
];

const LOCAIS: { v: IncidentLocation; l: string }[] = [
  { v: "portaria", l: "Portaria" },
  { v: "gate", l: "Gate" },
  { v: "patio", l: "Pátio" },
  { v: "empilhadeira", l: "Empilhadeira" },
  { v: "administrativo", l: "Área administrativa" },
];

type UserOpt = { id: string; label: string };

function parseUsers(raw: unknown): UserOpt[] {
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  const arr = (o.data as unknown[]) ?? (o.items as unknown[]) ?? (Array.isArray(raw) ? (raw as unknown[]) : []);
  const out: UserOpt[] = [];
  for (const row of arr) {
    if (row && typeof row === "object") {
      const r = row as Record<string, unknown>;
      const id = String(r.id ?? r.uuid ?? "");
      const email = r.email != null ? String(r.email) : "";
      const nome = r.nome != null ? String(r.nome) : "";
      if (id) out.push({ id, label: nome || email || id.slice(0, 8) });
    }
  }
  return out;
}

export function IncidentForm({ onSaved }: { onSaved?: () => void }) {
  const fid = useId();
  const [tipo, setTipo] = useState<IncidentType>("quase_acidente");
  const [local, setLocal] = useState<IncidentLocation>("patio");
  const [risco, setRisco] = useState<RiskLevel>("medio");
  const [descricao, setDescricao] = useState("");
  const [impacto, setImpacto] = useState("");
  const [pfmea, setPfmea] = useState("");
  const [userOpts, setUserOpts] = useState<UserOpt[]>([]);
  const [picked, setPicked] = useState<UserOpt[]>([]);
  const [query, setQuery] = useState("");
  const [evidencias, setEvidencias] = useState<string[]>([]);

  useEffect(() => {
    void (async () => {
      const u = await staffTryJson<unknown>("/users");
      setUserOpts(parseUsers(u));
    })();
  }, []);

  const filtered = userOpts.filter((u) => u.label.toLowerCase().includes(query.toLowerCase())).slice(0, 8);

  const addUser = (u: UserOpt) => {
    if (picked.some((p) => p.id === u.id)) return;
    setPicked([...picked, u]);
    setQuery("");
  };

  const filesToB64 = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const ops: Promise<string>[] = [];
    for (let i = 0; i < Math.min(files.length, 6); i++) {
      const f = files[i]!;
      if (f.size > 1_200_000) {
        toast.warning(`Arquivo ${f.name} muito grande — ignorado.`);
        continue;
      }
      ops.push(
        new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result ?? ""));
          r.onerror = () => rej(new Error("read"));
          r.readAsDataURL(f);
        }),
      );
    }
    void Promise.all(ops).then((parts) => setEvidencias((e) => [...e, ...parts].slice(0, 12)));
  }, []);

  function submit() {
    if (!descricao.trim()) {
      toast.error("Descreva o incidente.");
      return;
    }
    const row: IncidentRecord = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      tipo,
      local,
      envolvidosIds: picked.map((p) => p.id),
      envolvidosLabels: picked.map((p) => p.label),
      riscoPercebido: risco,
      descricao: descricao.trim(),
      evidenciasBase64: evidencias,
      impactoOperacional: impacto.trim(),
      classificacaoPfmea: pfmea.trim(),
    };
    ssmaStorage.incidents.add(row);
    toast.success("Incidente registrado localmente.");
    setDescricao("");
    setImpacto("");
    setPfmea("");
    setEvidencias([]);
    setPicked([]);
    onSaved?.();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-[11px] text-zinc-500">
          Tipo
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-sm text-white"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as IncidentType)}
          >
            {TIPOS.map((t) => (
              <option key={t.v} value={t.v}>
                {t.l}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-zinc-500">
          Local
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-sm text-white"
            value={local}
            onChange={(e) => setLocal(e.target.value as IncidentLocation)}
          >
            {LOCAIS.map((t) => (
              <option key={t.v} value={t.v}>
                {t.l}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-zinc-500">
          Risco percebido
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-sm text-white"
            value={risco}
            onChange={(e) => setRisco(e.target.value as RiskLevel)}
          >
            <option value="baixo">Baixo</option>
            <option value="medio">Médio</option>
            <option value="alto">Alto</option>
          </select>
        </label>
        <div className="text-[11px] text-zinc-500">
          Evidências (somente neste navegador)
          <input
            id={fid}
            type="file"
            accept="image/*"
            multiple
            className="mt-1 w-full text-xs text-zinc-400"
            onChange={(e) => void filesToB64(e.target.files)}
          />
        </div>
      </div>

      <div>
        <p className="text-[11px] text-zinc-500">Envolvidos (GET /users quando disponível)</p>
        <div className="relative mt-1">
          <input
            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-amber-500/50"
            placeholder="Buscar por nome ou e-mail..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query.length > 1 && filtered.length ? (
            <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-amber-500/20 bg-zinc-950 py-1 text-sm shadow-xl">
              {filtered.map((u) => (
                <li key={u.id}>
                  <button type="button" className="w-full px-3 py-2 text-left hover:bg-amber-950/40" onClick={() => addUser(u)}>
                    {u.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {picked.map((p) => (
            <span key={p.id} className="rounded-full bg-amber-900/40 px-3 py-1 text-xs text-amber-100">
              {p.label}
              <button
                type="button"
                className="ml-2 text-rose-300"
                onClick={() => setPicked(picked.filter((x) => x.id !== p.id))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <label className="block text-[11px] text-zinc-500">
        Descrição
        <textarea
          className="mt-1 min-h-[100px] w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[11px] text-zinc-500">
          Impacto operacional
          <textarea
            className="mt-1 min-h-[72px] w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
            value={impacto}
            onChange={(e) => setImpacto(e.target.value)}
          />
        </label>
        <label className="text-[11px] text-zinc-500">
          Classificação preliminar (PFMEA-style)
          <textarea
            className="mt-1 min-h-[72px] w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
            value={pfmea}
            onChange={(e) => setPfmea(e.target.value)}
            placeholder="S × O × D, família de falha..."
          />
        </label>
      </div>

      {evidencias.length ? (
        <div className="flex flex-wrap gap-2">
          {evidencias.map((src, i) => (
            <img key={i} src={src} alt="" className="h-16 w-16 rounded-md border border-white/10 object-cover" />
          ))}
        </div>
      ) : null}

      <Button type="button" className="bg-amber-600 hover:bg-amber-500" onClick={submit}>
        Gravar localmente
      </Button>
      <p className="text-[10px] text-zinc-600">Nenhum dado é enviado ao servidor — armazenamento apenas no navegador.</p>
    </div>
  );
}
