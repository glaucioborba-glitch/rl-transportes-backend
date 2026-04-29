"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { staffJson } from "@/lib/api/staff-client";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import type { AdminContract } from "@/lib/admin/types";
import { readJson, writeJson, adminContractsKey } from "@/lib/admin/storage";
import { contractStatusFromDates, stableContractPayload } from "@/lib/admin/contract-helpers";
import { sha256Hex } from "@/lib/admin/crypto-sha256";
import { ContractCard } from "@/components/admin/contract-card";
import { CommercialTableEditor } from "@/components/admin/commercial-table-editor";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

type Tab = "dados" | "comercial" | "sla" | "penal" | "revisao";

export default function AdminContratoNovoPage() {
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("dados");
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [vIni, setVIni] = useState("");
  const [vFim, setVFim] = useState("");
  const [condicao, setCondicao] = useState("");
  const [modeloCobranca, setModeloCobranca] = useState("Diária progressiva + banda de armazenagem");
  const [commercial, setCommercial] = useState({ liftOn: 1200, liftOff: 1200, armazenagem: 85, taxasExtras: "Reefer, sob estadia" });
  const [sla, setSla] = useState({ gateInMaxH: 4, gateOutMaxH: 6, dwellMedEsperadoH: 48, expedicaoMaxH: 12 });
  const [penalidades, setPenalidades] = useState<AdminContract["penalidades"]>([
    { descricao: "Atraso gate-in", fator: 0.02, tipoDia: "uteis" },
    { descricao: "Dwell excedente", fator: 0.015, tipoDia: "corridos" },
  ]);

  useEffect(() => {
    void staffJson<{ data: { id: string; nome: string }[] }>("/clientes?page=1&limit=100")
      .then((r) => setClientes(r.data ?? []))
      .catch(() => setClientes([]));
  }, []);

  if (!allowed) return null;

  const tabs: { id: Tab; label: string }[] = [
    { id: "dados", label: "Dados" },
    { id: "comercial", label: "Comercial" },
    { id: "sla", label: "SLA" },
    { id: "penal", label: "Penalidades" },
    { id: "revisao", label: "Revisão" },
  ];

  async function submit() {
    const nome = clientes.find((c) => c.id === clienteId)?.nome ?? "Cliente";
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `ct-${Date.now()}`;
    const base: Omit<AdminContract, "fingerprint" | "versaoDoc" | "createdAt" | "id"> = {
      clienteId,
      clienteNome: nome,
      vigenciaInicio: vIni,
      vigenciaFim: vFim,
      condicaoResumo: condicao,
      sla,
      commercial,
      modeloCobranca: modeloCobranca,
      penalidades,
      status: contractStatusFromDates(vFim),
    };
    const fp = await sha256Hex(stableContractPayload(base));
    const versaoDoc = `1.${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.${String(Date.now()).slice(-4)}`;
    const full: AdminContract = {
      id,
      ...base,
      fingerprint: fp,
      versaoDoc,
      createdAt: new Date().toISOString(),
    };
    const list = readJson<AdminContract[]>(adminContractsKey(), []);
    writeJson(adminContractsKey(), [...list, full]);
    toast.success("Contrato gravado localmente.");
    router.push(`/admin/contratos/${encodeURIComponent(id)}`);
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/contratos" className="text-sm text-sky-400 hover:underline">
        ← Contratos
      </Link>
      <div>
        <h1 className="font-serif text-3xl font-bold text-white">Novo contrato</h1>
        <p className="text-sm text-zinc-500">Formulário completo — persistência apenas no navegador.</p>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-white/10 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-t-lg px-4 py-2 text-xs font-bold uppercase tracking-wide",
              tab === t.id ? "bg-sky-500/20 text-sky-100" : "text-zinc-500 hover:bg-white/5",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dados" && (
        <ContractCard title="Dados do cliente & vigência" subtitle="Identificação">
          <label className="block text-xs text-zinc-500">
            Cliente
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
            >
              <option value="">Selecione…</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-zinc-500">
              Início vigência
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
                value={vIni}
                onChange={(e) => setVIni(e.target.value)}
              />
            </label>
            <label className="text-xs text-zinc-500">
              Fim vigência
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
                value={vFim}
                onChange={(e) => setVFim(e.target.value)}
              />
            </label>
          </div>
          <label className="text-xs text-zinc-500">
            Condição negocial (resumo)
            <textarea
              className="mt-1 min-h-[100px] w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
              value={condicao}
              onChange={(e) => setCondicao(e.target.value)}
            />
          </label>
        </ContractCard>
      )}

      {tab === "comercial" && (
        <ContractCard title="Tabela comercial & modelo de cobrança" subtitle="Lift / armazenagem">
          <CommercialTableEditor value={commercial} onChange={setCommercial} />
          <label className="mt-4 block text-xs text-zinc-500">
            Modelo de cobrança
            <textarea
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
              value={modeloCobranca}
              onChange={(e) => setModeloCobranca(e.target.value)}
            />
          </label>
        </ContractCard>
      )}

      {tab === "sla" && (
        <ContractCard title="SLAs obrigatórios" subtitle="Metas contratuais (horas)">
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["gateInMaxH", "Gate-in máximo (h)"],
                ["gateOutMaxH", "Gate-out máximo (h)"],
                ["dwellMedEsperadoH", "Dwell médio esperado (h)"],
                ["expedicaoMaxH", "Expedição máxima (h)"],
              ] as const
            ).map(([k, lbl]) => (
              <label key={k} className="text-xs text-zinc-500">
                {lbl}
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
                  value={sla[k]}
                  onChange={(e) => setSla({ ...sla, [k]: Number(e.target.value) })}
                />
              </label>
            ))}
          </div>
        </ContractCard>
      )}

      {tab === "penal" && (
        <ContractCard title="Penalidades contratuais" subtitle="Somente cadastro local">
          <ul className="space-y-2">
            {penalidades.map((p, i) => (
              <li key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-white/5 p-2">
                <input
                  className="flex-1 min-w-[140px] rounded border border-white/10 bg-zinc-900 px-2 py-1 text-sm"
                  value={p.descricao}
                  onChange={(e) => {
                    const n = [...penalidades];
                    n[i] = { ...p, descricao: e.target.value };
                    setPenalidades(n);
                  }}
                />
                <input
                  type="number"
                  step="0.001"
                  className="w-24 rounded border border-white/10 bg-zinc-900 px-2 py-1 text-sm"
                  value={p.fator}
                  onChange={(e) => {
                    const n = [...penalidades];
                    n[i] = { ...p, fator: Number(e.target.value) };
                    setPenalidades(n);
                  }}
                />
                <select
                  className="rounded border border-white/10 bg-zinc-900 px-2 py-1 text-sm"
                  value={p.tipoDia}
                  onChange={(e) => {
                    const n = [...penalidades];
                    n[i] = { ...p, tipoDia: e.target.value as "corridos" | "uteis" };
                    setPenalidades(n);
                  }}
                >
                  <option value="uteis">úteis</option>
                  <option value="corridos">corridos</option>
                </select>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="outline"
            className="mt-2 border-zinc-600"
            onClick={() => setPenalidades([...penalidades, { descricao: "Nova cláusula", fator: 0.01, tipoDia: "uteis" }])}
          >
            Adicionar cláusula
          </Button>
        </ContractCard>
      )}

      {tab === "revisao" && (
        <ContractCard title="Revisão & assinatura lógica" subtitle="Fingerprint SHA-256 será gerado no save">
          <ul className="text-sm text-zinc-400 space-y-1">
            <li>Cliente: {clienteId ? clientes.find((c) => c.id === clienteId)?.nome : "—"}</li>
            <li>
              Vigência: {vIni || "—"} → {vFim || "—"}
            </li>
            <li>SLA gate-in: {sla.gateInMaxH}h · dwell: {sla.dwellMedEsperadoH}h</li>
          </ul>
          <Button
            type="button"
            disabled={!clienteId || !vIni || !vFim}
            className="mt-4 bg-emerald-600 hover:bg-emerald-500"
            onClick={() => void submit()}
          >
            Gravar contrato (local)
          </Button>
        </ContractCard>
      )}
    </div>
  );
}
