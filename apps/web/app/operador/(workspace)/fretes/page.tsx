"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2, Plus, RefreshCw, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "@/lib/toast";
import { ApiError } from "@/lib/api/staff-client";
import {
  createFrete,
  listFretes,
  patchFrete,
  sincronizarFretes,
  type FreteRow,
  type FreteWrite,
} from "@/lib/api/fretes-client";
import {
  STATUS_FRETE,
  STATUS_FRETE_META,
  TIPO_FRETE,
  TIPO_FRETE_LABEL,
  hojeIsoSaoPaulo,
  inicioSemanaIso,
  type StatusFrete,
  type TipoFrete,
} from "@/lib/fretes/frete-status";
import { formatCpfBr } from "@/lib/format-cpf-cnpj-br";
import { formatContainerISO, stripContainerISO } from "@/utils/containerFormatter";
import {
  listCadastrosLocaisTransporte,
  type CadastroLocalTransporte,
} from "@/lib/api/cadastros-locais-transporte-client";

type Periodo = "hoje" | "semana" | "todos";

const cell =
  "h-8 w-full min-w-0 border-0 bg-transparent px-1 text-xs outline-none focus:bg-white/50";
const selectCell = `${cell} cursor-pointer`;
const novoSelectClass =
  "flex h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white";

function labelLocalCadastro(local: CadastroLocalTransporte) {
  return `${local.nome} (${local.codigo})`;
}

function LocalSelect({
  value,
  onChange,
  locais,
  className,
}: {
  value: string;
  onChange: (v: string | null) => void;
  locais: CadastroLocalTransporte[];
  className?: string;
}) {
  const atual = value.trim();
  const matched = locais.find((l) => l.nome === atual || labelLocalCadastro(l) === atual);
  const selecionado = matched?.nome ?? atual;
  const extras: CadastroLocalTransporte[] = [];
  if (matched && !matched.ativo) extras.push(matched);
  const ativos = locais.filter((l) => l.ativo);
  const orfao = atual && !matched;

  return (
    <select
      className={className}
      value={selecionado}
      onChange={(e) => onChange(e.target.value.trim() || null)}
    >
      <option value="">—</option>
      {orfao ? <option value={atual}>{atual}</option> : null}
      {extras.map((l) => (
        <option key={l.id} value={l.nome}>
          {labelLocalCadastro(l)}
        </option>
      ))}
      {ativos.map((l) => (
        <option key={l.id} value={l.nome}>
          {labelLocalCadastro(l)}
        </option>
      ))}
    </select>
  );
}

function emptyNovo(hoje: string): FreteWrite {
  return {
    dataRef: hoje,
    janela: "",
    numeroIso: "",
    statusCarga: "CHEIO",
    tipo: "EXP",
    local: "",
    clienteNome: "",
    motoristaNome: "",
    cpfMotorista: "",
    placaCavalo: "",
    placaCarreta: "",
    valor: null,
    status: "PENDENTE",
  };
}

export default function FretesPage() {
  const hoje = useMemo(() => hojeIsoSaoPaulo(), []);
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const [statusFiltro, setStatusFiltro] = useState("");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<FreteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNovo, setShowNovo] = useState(false);
  const [novo, setNovo] = useState<FreteWrite>(() => emptyNovo(hoje));
  const [locais, setLocais] = useState<CadastroLocalTransporte[]>([]);

  const range = useMemo(() => {
    if (periodo === "hoje") return { from: hoje, to: hoje };
    if (periodo === "semana") return { from: inicioSemanaIso(hoje), to: hoje };
    return {};
  }, [periodo, hoje]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listFretes({
        ...range,
        status: statusFiltro || undefined,
        q,
      });
      setRows(res.items);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível carregar os fretes.");
    } finally {
      setLoading(false);
    }
  }, [range, statusFiltro, q]);

  useEffect(() => {
    const t = window.setTimeout(() => setQ(qInput), 400);
    return () => window.clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let on = true;
    void listCadastrosLocaisTransporte()
      .then((res) => {
        if (on) setLocais(res.items);
      })
      .catch(() => {
        if (on) toast.error("Não foi possível carregar origens e destinos.");
      });
    return () => {
      on = false;
    };
  }, []);

  async function salvarCampo(id: string, patch: Partial<FreteWrite>) {
    try {
      const updated = await patchFrete(id, patch);
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível salvar.");
      void load();
    }
  }

  async function incluir() {
    if (!novo.clienteNome.trim() || stripContainerISO(novo.numeroIso).length < 4) {
      toast.error("Informe contêiner e cliente.");
      return;
    }
    setSaving(true);
    try {
      await createFrete({
        ...novo,
        numeroIso: stripContainerISO(novo.numeroIso),
        janela: novo.janela?.trim() || null,
        local: novo.local?.trim() || null,
        motoristaNome: novo.motoristaNome?.trim() || null,
        cpfMotorista: novo.cpfMotorista?.replace(/\D/g, "") || null,
        placaCavalo: novo.placaCavalo?.trim() || null,
        placaCarreta: novo.placaCarreta?.trim() || null,
      });
      toast.success("Frete incluído.");
      setNovo(emptyNovo(hoje));
      setShowNovo(false);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível incluir.");
    } finally {
      setSaving(false);
    }
  }

  async function sincronizar() {
    setSaving(true);
    try {
      const out = await sincronizarFretes();
      toast.success(
        out.criados
          ? `${out.criados} frete(s) gerado(s) das solicitações FL.`
          : "Nenhuma solicitação FL pendente de frete.",
      );
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao sincronizar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 px-2 py-1.5">
        <h1 className="flex items-center gap-1.5 pr-1 text-sm font-semibold text-white">
          <Truck className="h-4 w-4" />
          Fretes
        </h1>
        <div className="flex gap-0.5 rounded-md border border-white/10 p-0.5">
          {(
            [
              ["hoje", "Hoje"],
              ["semana", "Semana"],
              ["todos", "Todos"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`rounded px-2 py-1 text-[11px] font-medium ${
                periodo === id ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"
              }`}
              onClick={() => setPeriodo(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          aria-label="Estágio"
          className="h-8 rounded-md border border-white/10 bg-black/30 px-2 text-xs text-white"
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value)}
        >
          <option value="">Estágio: todos</option>
          {STATUS_FRETE.map((s) => (
            <option key={s} value={s}>
              {STATUS_FRETE_META[s].label}
            </option>
          ))}
        </select>
        <Input
          className="h-8 min-w-[180px] max-w-xs flex-1 text-xs"
          placeholder="Contêiner, cliente, motorista…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />
        <span className="hidden text-[11px] text-slate-500 sm:inline">{rows.length} linha(s)</span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => void load()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Atualizar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={saving}
            onClick={() => void sincronizar()}
          >
            Puxar FL
          </Button>
          <Button type="button" size="sm" className="h-8" onClick={() => setShowNovo((v) => !v)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Novo
          </Button>
          <ThemeToggle className="h-8 w-8" />
        </div>
      </header>

      {showNovo ? (
        <div className="shrink-0 border-b border-white/10 bg-[#121820] px-3 py-3">
          <p className="mb-3 text-sm font-medium text-white">Incluir na planilha</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <Field label="Data">
              <Input type="date" value={novo.dataRef} onChange={(e) => setNovo({ ...novo, dataRef: e.target.value })} />
            </Field>
            <Field label="Janela">
              <Input placeholder="08x09" value={novo.janela ?? ""} onChange={(e) => setNovo({ ...novo, janela: e.target.value })} />
            </Field>
            <Field label="Contêiner">
              <Input
                className="font-mono"
                value={formatContainerISO(novo.numeroIso)}
                onChange={(e) => setNovo({ ...novo, numeroIso: stripContainerISO(e.target.value) })}
              />
            </Field>
            <Field label="Situação">
              <select
                className="flex h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
                value={novo.statusCarga}
                onChange={(e) => setNovo({ ...novo, statusCarga: e.target.value as "CHEIO" | "VAZIO" })}
              >
                <option value="CHEIO">CHEIO</option>
                <option value="VAZIO">VAZIO</option>
              </select>
            </Field>
            <Field label="Tipo">
              <select
                className="flex h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
                value={novo.tipo}
                onChange={(e) => setNovo({ ...novo, tipo: e.target.value as TipoFrete })}
              >
                {TIPO_FRETE.map((t) => (
                  <option key={t} value={t}>
                    {TIPO_FRETE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Local">
              <LocalSelect
                className={novoSelectClass}
                value={novo.local ?? ""}
                locais={locais}
                onChange={(v) => setNovo({ ...novo, local: v ?? "" })}
              />
            </Field>
            <Field label="Cliente">
              <Input value={novo.clienteNome} onChange={(e) => setNovo({ ...novo, clienteNome: e.target.value })} />
            </Field>
            <Field label="Motorista">
              <Input
                value={novo.motoristaNome ?? ""}
                onChange={(e) => setNovo({ ...novo, motoristaNome: e.target.value })}
              />
            </Field>
            <Field label="CPF">
              <Input
                inputMode="numeric"
                autoComplete="off"
                placeholder="000.000.000-00"
                value={formatCpfBr(novo.cpfMotorista ?? "")}
                onChange={(e) =>
                  setNovo({ ...novo, cpfMotorista: e.target.value.replace(/\D/g, "").slice(0, 11) })
                }
              />
            </Field>
            <Field label="Cavalo">
              <Input
                value={novo.placaCavalo ?? ""}
                onChange={(e) => setNovo({ ...novo, placaCavalo: e.target.value.toUpperCase() })}
              />
            </Field>
            <Field label="Carreta">
              <Input
                value={novo.placaCarreta ?? ""}
                onChange={(e) => setNovo({ ...novo, placaCarreta: e.target.value.toUpperCase() })}
              />
            </Field>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowNovo(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" disabled={saving} onClick={() => void incluir()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Incluir
            </Button>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto bg-white">
        <table className="min-w-[1280px] w-full border-collapse text-left text-xs text-zinc-900">
          <thead>
            <tr className="bg-zinc-100 text-[11px] uppercase tracking-wide text-zinc-600">
              <th className="sticky left-0 z-10 bg-zinc-100 px-2 py-2">Data</th>
              <th className="px-2 py-2">Janela</th>
              <th className="px-2 py-2">Contêiner</th>
              <th className="px-2 py-2">Situação</th>
              <th className="px-2 py-2">Tipo</th>
              <th className="px-2 py-2">Local</th>
              <th className="px-2 py-2">Cliente</th>
              <th className="px-2 py-2">Motorista</th>
              <th className="px-2 py-2">CPF</th>
              <th className="px-2 py-2">Cavalo</th>
              <th className="px-2 py-2">Carreta</th>
              <th className="px-2 py-2">Estágio</th>
              <th className="px-2 py-2">Protocolo</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={13} className="px-4 py-10 text-center text-zinc-500">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-4 py-10 text-center text-zinc-500">
                  Nenhum frete neste filtro. Inclua uma linha ou puxe as solicitações de frota FL.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const meta = STATUS_FRETE_META[row.status];
                return (
                  <tr key={row.id} style={{ background: meta.bg, color: meta.color }}>
                    <td className="sticky left-0 z-10 px-1 py-0.5" style={{ background: meta.bg }}>
                      <input
                        type="date"
                        className={cell}
                        defaultValue={row.dataRef}
                        onBlur={(e) => {
                          if (e.target.value && e.target.value !== row.dataRef) {
                            void salvarCampo(row.id, { dataRef: e.target.value });
                          }
                        }}
                      />
                    </td>
                    <td className="px-1 py-0.5">
                      <input
                        className={cell}
                        defaultValue={row.janela ?? ""}
                        placeholder="08x09"
                        onBlur={(e) => {
                          const v = e.target.value.trim() || null;
                          if (v !== (row.janela ?? null)) void salvarCampo(row.id, { janela: v });
                        }}
                      />
                    </td>
                    <td className="px-1 py-0.5">
                      <input
                        className={`${cell} font-mono`}
                        defaultValue={formatContainerISO(row.numeroIso)}
                        onBlur={(e) => {
                          const v = stripContainerISO(e.target.value);
                          if (v && v !== row.numeroIso) void salvarCampo(row.id, { numeroIso: v });
                        }}
                      />
                    </td>
                    <td className="px-1 py-0.5">
                      <select
                        className={selectCell}
                        value={row.statusCarga}
                        onChange={(e) =>
                          void salvarCampo(row.id, { statusCarga: e.target.value as "CHEIO" | "VAZIO" })
                        }
                      >
                        <option value="CHEIO">CHEIO</option>
                        <option value="VAZIO">VAZIO</option>
                      </select>
                    </td>
                    <td className="px-1 py-0.5">
                      <select
                        className={selectCell}
                        value={row.tipo}
                        onChange={(e) => void salvarCampo(row.id, { tipo: e.target.value as TipoFrete })}
                      >
                        {TIPO_FRETE.map((t) => (
                          <option key={t} value={t}>
                            {TIPO_FRETE_LABEL[t]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1 py-0.5">
                      <LocalSelect
                        className={selectCell}
                        value={row.local ?? ""}
                        locais={locais}
                        onChange={(v) => {
                          if (v !== (row.local ?? null)) void salvarCampo(row.id, { local: v });
                        }}
                      />
                    </td>
                    <td className="px-1 py-0.5">
                      <input
                        className={cell}
                        defaultValue={row.clienteNome}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== row.clienteNome) void salvarCampo(row.id, { clienteNome: v });
                        }}
                      />
                    </td>
                    <td className="px-1 py-0.5">
                      <input
                        className={cell}
                        defaultValue={row.motoristaNome ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value.trim() || null;
                          if (v !== (row.motoristaNome ?? null)) {
                            void salvarCampo(row.id, { motoristaNome: v });
                          }
                        }}
                      />
                    </td>
                    <td className="px-1 py-0.5">
                      <input
                        className={`${cell} font-mono`}
                        inputMode="numeric"
                        placeholder="000.000.000-00"
                        defaultValue={formatCpfBr(row.cpfMotorista ?? "")}
                        onBlur={(e) => {
                          const v = e.target.value.replace(/\D/g, "") || null;
                          const atual = (row.cpfMotorista ?? "").replace(/\D/g, "") || null;
                          if (v !== atual) void salvarCampo(row.id, { cpfMotorista: v });
                        }}
                      />
                    </td>
                    <td className="px-1 py-0.5">
                      <input
                        className={`${cell} uppercase`}
                        defaultValue={row.placaCavalo ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value.trim().toUpperCase() || null;
                          if (v !== (row.placaCavalo ?? null)) void salvarCampo(row.id, { placaCavalo: v });
                        }}
                      />
                    </td>
                    <td className="px-1 py-0.5">
                      <input
                        className={`${cell} uppercase`}
                        defaultValue={row.placaCarreta ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value.trim().toUpperCase() || null;
                          if (v !== (row.placaCarreta ?? null)) void salvarCampo(row.id, { placaCarreta: v });
                        }}
                      />
                    </td>
                    <td className="px-1 py-0.5">
                      <select
                        className={`${selectCell} font-semibold`}
                        value={row.status}
                        onChange={(e) =>
                          void salvarCampo(row.id, { status: e.target.value as StatusFrete })
                        }
                      >
                        {STATUS_FRETE.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_FRETE_META[s].label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1 font-mono text-[11px] opacity-80">
                      {row.protocolo ?? "—"}
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-slate-500">{label}</span>
      {children}
    </label>
  );
}
