"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api/staff-client";
import {
  atualizarClienteCondicao,
  listarClientesCondicoes,
  listarCondicoesPagamento,
  listarPrazosPagamento,
  listarTabelasPrecoAtribuicao,
  listarTabelasTransporteAtribuicao,
  listarTabelasServicoAtribuicao,
  listarTabelasAluguelAtribuicao,
  type ClienteCondicaoRow,
  type TabelaPrecoAtribuicao,
  type TabelaTransporteAtribuicao,
  type TabelaServicoAtribuicao,
  type TabelaAluguelAtribuicao,
} from "@/lib/api/cadastro-financeiro-client";
import {
  CONDICAO_PAGAMENTO_PADRAO_VALUE,
  OPCOES_CONDICAO_PAGAMENTO,
  PRAZOS_PAGAMENTO,
  isCondicaoPagamentoApiValue,
  toCondicaoPagamentoApiValue,
  type CondicaoPagamentoOption,
} from "@/lib/condicao-pagamento-portal";
import { isIntranetGestorRole } from "@/lib/intranet/intranet-path-access";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { toast } from "@/lib/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCpfCnpjBr } from "@/lib/format-cpf-cnpj-br";

type Draft = {
  condicaoPagamento: string;
  prazoPagamento: string;
  cadastroTabelaPrecoId: string;
  cadastroTabelaTransporteId: string;
  cadastroTabelaServicoId: string;
  cadastroTabelaAluguelId: string;
  faturamentoModo: "MANUAL" | "AUTOMATICO";
  faturamentoHora: string;
};

const SELECT_CLASS =
  "h-9 w-full min-w-0 max-w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white disabled:cursor-not-allowed disabled:opacity-60";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

function TabelaSelect({
  label,
  value,
  options,
  ariaLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; nome: string; padrao: boolean }[];
  ariaLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <select className={SELECT_CLASS} value={value} onChange={(e) => onChange(e.target.value)} aria-label={ariaLabel}>
        {options.length === 0 ? <option value="">Sem tabela vigente</option> : null}
        {options.map((t) => (
          <option key={t.id} value={t.id}>
            {t.padrao ? `${t.nome} (padrão)` : t.nome}
          </option>
        ))}
      </select>
    </Field>
  );
}

function tabelaPadraoId(tabelas: { id: string; padrao: boolean }[]): string {
  return tabelas.find((t) => t.padrao)?.id ?? tabelas[0]?.id ?? "";
}

function savedValues(
  row: ClienteCondicaoRow,
  opcoesPrazo: CondicaoPagamentoOption[],
  tabelas: TabelaPrecoAtribuicao[],
  tabelasTransporte: TabelaTransporteAtribuicao[],
  tabelasServico: TabelaServicoAtribuicao[],
  tabelasAluguel: TabelaAluguelAtribuicao[],
): Draft {
  const prazoSalvo = row.prazoPagamento?.trim() ?? "";
  const formaSalva = row.condicaoPagamento?.trim() ?? "";
  return {
    condicaoPagamento: formaSalva || CONDICAO_PAGAMENTO_PADRAO_VALUE,
    prazoPagamento: prazoSalvo || opcoesPrazo[0]?.value || "30_DIAS",
    cadastroTabelaPrecoId: row.cadastroTabelaPrecoId || tabelaPadraoId(tabelas),
    cadastroTabelaTransporteId: row.cadastroTabelaTransporteId || tabelaPadraoId(tabelasTransporte),
    cadastroTabelaServicoId: row.cadastroTabelaServicoId || tabelaPadraoId(tabelasServico),
    cadastroTabelaAluguelId: row.cadastroTabelaAluguelId || tabelaPadraoId(tabelasAluguel),
    faturamentoModo: row.faturamentoModo === "AUTOMATICO" ? "AUTOMATICO" : "MANUAL",
    faturamentoHora: row.faturamentoHora || "18:00",
  };
}

function mergeTabelaOption<T extends { id: string; nome: string; padrao: boolean }>(
  items: T[],
  savedId: string | null | undefined,
): T[] {
  if (!savedId || items.some((i) => i.id === savedId)) return items;
  return [{ id: savedId, nome: "Tabela atribuída", padrao: false } as T, ...items];
}

function mergeValorOption(opcoes: CondicaoPagamentoOption[], saved: string | null | undefined): CondicaoPagamentoOption[] {
  const value = saved?.trim();
  if (!value || opcoes.some((o) => o.value === value)) return opcoes;
  return [...opcoes, { label: value, value }];
}

export default function CondicoesClientesPage() {
  const user = useStaffAuthStore((s) => s.user);
  const ok = isIntranetGestorRole(user?.role);
  const [rows, setRows] = useState<ClienteCondicaoRow[]>([]);
  const [edits, setEdits] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [opcoesForma, setOpcoesForma] = useState<CondicaoPagamentoOption[]>([
    ...OPCOES_CONDICAO_PAGAMENTO,
  ]);
  const [opcoesPrazo, setOpcoesPrazo] = useState<CondicaoPagamentoOption[]>([...PRAZOS_PAGAMENTO]);
  const [tabelas, setTabelas] = useState<TabelaPrecoAtribuicao[]>([]);
  const [tabelasTransporte, setTabelasTransporte] = useState<TabelaTransporteAtribuicao[]>([]);
  const [tabelasServico, setTabelasServico] = useState<TabelaServicoAtribuicao[]>([]);
  const [tabelasAluguel, setTabelasAluguel] = useState<TabelaAluguelAtribuicao[]>([]);

  const load = useCallback(async () => {
    if (!ok) return;
    setLoading(true);
    try {
      const list = await listarClientesCondicoes(busca);
      setRows(list);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao carregar clientes");
    } finally {
      setLoading(false);
    }
  }, [ok, busca]);

  useEffect(() => {
    if (!ok) return;
    void Promise.all([
      listarCondicoesPagamento(),
      listarPrazosPagamento(),
      listarTabelasPrecoAtribuicao(),
      listarTabelasTransporteAtribuicao(),
      listarTabelasServicoAtribuicao(),
      listarTabelasAluguelAtribuicao(),
    ])
      .then(([formas, prazos, tabs, tabsTransporte, tabsServico, tabsAluguel]) => {
        if (formas.length) setOpcoesForma(formas);
        if (prazos.length) setOpcoesPrazo(prazos);
        if (tabs.length) setTabelas(tabs);
        if (tabsTransporte.length) setTabelasTransporte(tabsTransporte);
        if (tabsServico.length) setTabelasServico(tabsServico);
        if (tabsAluguel.length) setTabelasAluguel(tabsAluguel);
      })
      .catch(() => {
        /* fallback estático */
      });
  }, [ok]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), busca ? 350 : 0);
    return () => window.clearTimeout(t);
  }, [load, busca]);

  const displayOf = useCallback(
    (row: ClienteCondicaoRow): Draft => {
      const saved = savedValues(
        row,
        opcoesPrazo,
        tabelas,
        tabelasTransporte,
        tabelasServico,
        tabelasAluguel,
      );
      return edits[row.id] ?? saved;
    },
    [edits, opcoesPrazo, tabelas, tabelasTransporte, tabelasServico, tabelasAluguel],
  );

  const dirtyIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of rows) {
      const edit = edits[row.id];
      if (!edit) continue;
      const saved = savedValues(
        row,
        opcoesPrazo,
        tabelas,
        tabelasTransporte,
        tabelasServico,
        tabelasAluguel,
      );
      if (
        edit.condicaoPagamento !== saved.condicaoPagamento ||
        edit.prazoPagamento !== saved.prazoPagamento ||
        edit.cadastroTabelaPrecoId !== saved.cadastroTabelaPrecoId ||
        edit.cadastroTabelaTransporteId !== saved.cadastroTabelaTransporteId ||
        edit.cadastroTabelaServicoId !== saved.cadastroTabelaServicoId ||
        edit.cadastroTabelaAluguelId !== saved.cadastroTabelaAluguelId ||
        edit.faturamentoModo !== saved.faturamentoModo ||
        (edit.faturamentoModo === "AUTOMATICO" && edit.faturamentoHora !== saved.faturamentoHora)
      ) {
        ids.add(row.id);
      }
    }
    return ids;
  }, [rows, edits, opcoesPrazo, tabelas, tabelasTransporte, tabelasServico, tabelasAluguel]);

  function patchDraft(row: ClienteCondicaoRow, patch: Partial<Draft>) {
    const current = displayOf(row);
    setEdits((prev) => ({ ...prev, [row.id]: { ...current, ...patch } }));
  }

  async function onSalvar(row: ClienteCondicaoRow) {
    const draft = displayOf(row);
    const forma = toCondicaoPagamentoApiValue(draft.condicaoPagamento, opcoesForma);
    setSavingId(row.id);
    try {
      await atualizarClienteCondicao(row.id, {
        condicaoPagamento: forma,
        prazoPagamento: draft.prazoPagamento,
        cadastroTabelaPrecoId: draft.cadastroTabelaPrecoId || undefined,
        cadastroTabelaTransporteId: draft.cadastroTabelaTransporteId || undefined,
        cadastroTabelaServicoId: draft.cadastroTabelaServicoId || undefined,
        cadastroTabelaAluguelId: draft.cadastroTabelaAluguelId || undefined,
        faturamentoModo: draft.faturamentoModo,
        faturamentoHora: draft.faturamentoModo === "AUTOMATICO" ? draft.faturamentoHora : "",
      });
      toast.success(`Condição de ${row.razaoSocial} atualizada.`);
      setEdits((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao salvar condição");
    } finally {
      setSavingId(null);
    }
  }

  if (!ok) {
    return (
      <div>
        <p className="text-amber-400">Área restrita a gestão (ADMIN / GERENTE).</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Forma e prazo</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Os valores exibidos são os gravados de cada cliente. Altere e clique em Salvar só o que for mudar.
          Manual: o financeiro escolhe os IDs na tela de Faturas. Automático: na hora informada (São Paulo)
          fecha a fila do dia. Novos cadastros entram em Manual e nas tabelas padrão. Catálogos em{" "}
          <a href="/cadastros/financeiro/servicos" className="text-sky-400 underline-offset-2 hover:underline">
            Cadastros → Serviços
          </a>{" "}
          e{" "}
          <a href="/cadastros/financeiro/aluguel" className="text-sky-400 underline-offset-2 hover:underline">
            Cadastros → Aluguel
          </a>
          . Só ADMIN e GERENTE alteram.
        </p>
      </div>

      <Card className="min-w-0 border-zinc-800 bg-zinc-950/80">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base text-zinc-100">Clientes aprovados</CardTitle>
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar empresa ou CNPJ"
            className="max-w-xs"
            aria-label="Buscar cliente"
          />
        </CardHeader>
        <CardContent className="min-w-0 space-y-3">
          {loading && rows.length === 0 ? (
            <p className="text-sm text-zinc-500">Carregando…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhum cliente aprovado encontrado.</p>
          ) : (
            rows.map((row) => {
              const draft = displayOf(row);
              const formas = mergeValorOption(opcoesForma, draft.condicaoPagamento);
              const prazos = mergeValorOption(opcoesPrazo, draft.prazoPagamento);
              const tabsPreco = mergeTabelaOption(tabelas, draft.cadastroTabelaPrecoId);
              const tabsTransporte = mergeTabelaOption(tabelasTransporte, draft.cadastroTabelaTransporteId);
              const tabsServico = mergeTabelaOption(tabelasServico, draft.cadastroTabelaServicoId);
              const tabsAluguel = mergeTabelaOption(tabelasAluguel, draft.cadastroTabelaAluguelId);
              return (
                <article
                  key={row.id}
                  className="grid grid-cols-12 items-end gap-x-3 gap-y-3 rounded-lg border-2 border-white/80 bg-zinc-900/40 p-3"
                >
                  <div className="col-span-12 min-w-0 xl:col-span-4">
                    <p className="truncate font-medium text-zinc-200" title={row.razaoSocial}>
                      {row.razaoSocial}
                    </p>
                    {row.nomeFantasia ? (
                      <p className="mt-0.5 truncate text-xs text-zinc-500" title={row.nomeFantasia}>
                        {row.nomeFantasia}
                      </p>
                    ) : null}
                    <p className="mt-0.5 font-mono text-xs text-zinc-400">{formatCpfCnpjBr(row.cpfCnpj)}</p>
                  </div>
                  <div className="col-span-6 xl:col-span-2">
                    <Field label="Forma">
                      <select
                        className={SELECT_CLASS}
                        value={draft.condicaoPagamento}
                        disabled={Boolean(
                          opcoesPrazo.find((p) => p.value === draft.prazoPagamento)?.formaVinculada,
                        )}
                        title="Definida pelo prazo comercial"
                        onChange={(e) => patchDraft(row, { condicaoPagamento: e.target.value })}
                        aria-label={`Forma de pagamento de ${row.razaoSocial}`}
                      >
                        {formas.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="col-span-6 xl:col-span-4">
                    <Field label="Prazo">
                      <select
                        className={SELECT_CLASS}
                        value={draft.prazoPagamento}
                        onChange={(e) => {
                          const prazo = e.target.value;
                          const vinculo = opcoesPrazo.find((p) => p.value === prazo)?.formaVinculada;
                          patchDraft(row, {
                            prazoPagamento: prazo,
                            ...(vinculo && isCondicaoPagamentoApiValue(vinculo, opcoesForma)
                              ? { condicaoPagamento: vinculo }
                              : {}),
                          });
                        }}
                        aria-label={`Prazo de ${row.razaoSocial}`}
                      >
                        {prazos.map((item) => {
                          const venc =
                            item.vencimentos?.length
                              ? item.vencimentos.join("/")
                              : item.dias != null
                                ? String(item.dias)
                                : "";
                          return (
                            <option key={item.value} value={item.value}>
                              {item.label}
                              {venc ? ` (${item.vencimentos?.length || 1}x · ${venc})` : ""}
                            </option>
                          );
                        })}
                      </select>
                    </Field>
                  </div>
                  <div className="col-span-12 flex justify-end xl:col-span-2">
                    <Button
                      type="button"
                      size="sm"
                      className="w-full xl:w-auto"
                      disabled={savingId === row.id || !dirtyIds.has(row.id)}
                      onClick={() => void onSalvar(row)}
                    >
                      Salvar
                    </Button>
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <TabelaSelect
                      label="Preços"
                      value={draft.cadastroTabelaPrecoId}
                      options={tabsPreco}
                      ariaLabel={`Tabela de preços de ${row.razaoSocial}`}
                      onChange={(cadastroTabelaPrecoId) => patchDraft(row, { cadastroTabelaPrecoId })}
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <TabelaSelect
                      label="Transportes"
                      value={draft.cadastroTabelaTransporteId}
                      options={tabsTransporte}
                      ariaLabel={`Tabela de transportes de ${row.razaoSocial}`}
                      onChange={(cadastroTabelaTransporteId) => patchDraft(row, { cadastroTabelaTransporteId })}
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <TabelaSelect
                      label="Serviços"
                      value={draft.cadastroTabelaServicoId}
                      options={tabsServico}
                      ariaLabel={`Tabela de serviços de ${row.razaoSocial}`}
                      onChange={(cadastroTabelaServicoId) => patchDraft(row, { cadastroTabelaServicoId })}
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <TabelaSelect
                      label="Aluguel"
                      value={draft.cadastroTabelaAluguelId}
                      options={tabsAluguel}
                      ariaLabel={`Tabela de aluguel de ${row.razaoSocial}`}
                      onChange={(cadastroTabelaAluguelId) => patchDraft(row, { cadastroTabelaAluguelId })}
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <Field label="Fatura">
                      <select
                        className={SELECT_CLASS}
                        value={draft.faturamentoModo}
                        onChange={(e) =>
                          patchDraft(row, {
                            faturamentoModo: e.target.value === "AUTOMATICO" ? "AUTOMATICO" : "MANUAL",
                          })
                        }
                        aria-label={`Modo de Fatura de ${row.razaoSocial}`}
                      >
                        <option value="MANUAL">Manual</option>
                        <option value="AUTOMATICO">Automático</option>
                      </select>
                    </Field>
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <Field label="Hora (SP)">
                      <input
                        type="time"
                        className={SELECT_CLASS}
                        value={draft.faturamentoHora}
                        disabled={draft.faturamentoModo !== "AUTOMATICO"}
                        onChange={(e) => patchDraft(row, { faturamentoHora: e.target.value })}
                        aria-label={`Hora automática de ${row.razaoSocial}`}
                      />
                    </Field>
                  </div>
                </article>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
