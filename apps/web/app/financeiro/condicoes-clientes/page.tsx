"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api/staff-client";
import {
  atualizarClienteCondicao,
  listarClientesCondicoes,
  listarCondicoesPagamento,
  listarPrazosPagamento,
  listarTabelasPrecoAtribuicao,
  listarTabelasTransporteAtribuicao,
  type ClienteCondicaoRow,
  type TabelaPrecoAtribuicao,
  type TabelaTransporteAtribuicao,
} from "@/lib/api/cadastro-financeiro-client";
import {
  CONDICAO_PAGAMENTO_PADRAO_VALUE,
  OPCOES_CONDICAO_PAGAMENTO,
  PRAZOS_PAGAMENTO,
  isCondicaoPagamentoApiValue,
  toCondicaoPagamentoApiValue,
  type CondicaoPagamentoOption,
} from "@/lib/condicao-pagamento-portal";
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
};

const SELECT_CLASS =
  "rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white disabled:cursor-not-allowed disabled:opacity-60";

function tabelaPadraoId(tabelas: { id: string; padrao: boolean }[]): string {
  return tabelas.find((t) => t.padrao)?.id ?? tabelas[0]?.id ?? "";
}

function savedValues(
  row: ClienteCondicaoRow,
  opcoesPrazo: CondicaoPagamentoOption[],
  tabelas: TabelaPrecoAtribuicao[],
  tabelasTransporte: TabelaTransporteAtribuicao[],
): Draft {
  const prazoSalvo = row.prazoPagamento?.trim() ?? "";
  const formaSalva = row.condicaoPagamento?.trim() ?? "";
  return {
    condicaoPagamento: formaSalva || CONDICAO_PAGAMENTO_PADRAO_VALUE,
    prazoPagamento: prazoSalvo || opcoesPrazo[0]?.value || "30_DIAS",
    cadastroTabelaPrecoId: row.cadastroTabelaPrecoId || tabelaPadraoId(tabelas),
    cadastroTabelaTransporteId: row.cadastroTabelaTransporteId || tabelaPadraoId(tabelasTransporte),
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
  const ok = user?.role === "ADMIN" || user?.role === "GERENTE";
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
    ])
      .then(([formas, prazos, tabs, tabsTransporte]) => {
        if (formas.length) setOpcoesForma(formas);
        if (prazos.length) setOpcoesPrazo(prazos);
        if (tabs.length) setTabelas(tabs);
        if (tabsTransporte.length) setTabelasTransporte(tabsTransporte);
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
      const saved = savedValues(row, opcoesPrazo, tabelas, tabelasTransporte);
      return edits[row.id] ?? saved;
    },
    [edits, opcoesPrazo, tabelas, tabelasTransporte],
  );

  const dirtyIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of rows) {
      const edit = edits[row.id];
      if (!edit) continue;
      const saved = savedValues(row, opcoesPrazo, tabelas, tabelasTransporte);
      if (
        edit.condicaoPagamento !== saved.condicaoPagamento ||
        edit.prazoPagamento !== saved.prazoPagamento ||
        edit.cadastroTabelaPrecoId !== saved.cadastroTabelaPrecoId ||
        edit.cadastroTabelaTransporteId !== saved.cadastroTabelaTransporteId
      ) {
        ids.add(row.id);
      }
    }
    return ids;
  }, [rows, edits, opcoesPrazo, tabelas, tabelasTransporte]);

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Forma e prazo</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Os valores exibidos são os gravados de cada cliente. Altere e clique em Salvar só o que for mudar. Novos
          cadastros entram nas tabelas padrão. Só ADMIN e GERENTE alteram.
        </p>
      </div>

      <Card className="border-zinc-800 bg-zinc-950/80">
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
        <CardContent className="overflow-x-auto">
          {loading && rows.length === 0 ? (
            <p className="text-sm text-zinc-500">Carregando…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhum cliente aprovado encontrado.</p>
          ) : (
            <table className="w-full min-w-[1240px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-2 py-3 font-medium">Empresa</th>
                  <th className="px-2 py-3 font-medium">CNPJ</th>
                  <th className="px-2 py-3 font-medium">Forma de pagamento</th>
                  <th className="px-2 py-3 font-medium">Prazo</th>
                  <th className="px-2 py-3 font-medium">Tabela de preços</th>
                  <th className="px-2 py-3 font-medium">Tabela de transportes</th>
                  <th className="px-2 py-3 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const draft = displayOf(row);
                  const formas = mergeValorOption(opcoesForma, draft.condicaoPagamento);
                  const prazos = mergeValorOption(opcoesPrazo, draft.prazoPagamento);
                  const tabsPreco = mergeTabelaOption(tabelas, draft.cadastroTabelaPrecoId);
                  const tabsTransporte = mergeTabelaOption(tabelasTransporte, draft.cadastroTabelaTransporteId);
                  return (
                    <tr key={row.id} className="border-b border-zinc-900/80">
                      <td className="px-2 py-3 text-zinc-200">
                        <span className="font-medium">{row.razaoSocial}</span>
                        {row.nomeFantasia ? (
                          <span className="mt-0.5 block text-xs text-zinc-500">{row.nomeFantasia}</span>
                        ) : null}
                      </td>
                      <td className="px-2 py-3 font-mono text-xs text-zinc-300">
                        {formatCpfCnpjBr(row.cpfCnpj)}
                      </td>
                      <td className="px-2 py-3">
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
                      </td>
                      <td className="px-2 py-3">
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
                      </td>
                      <td className="px-2 py-3">
                        <select
                          className={SELECT_CLASS}
                          value={draft.cadastroTabelaPrecoId}
                          onChange={(e) => patchDraft(row, { cadastroTabelaPrecoId: e.target.value })}
                          aria-label={`Tabela de preços de ${row.razaoSocial}`}
                        >
                          {tabsPreco.length === 0 ? <option value="">Sem tabela vigente</option> : null}
                          {tabsPreco.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.padrao ? `${t.nome} (padrão)` : t.nome}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-3">
                        <select
                          className={SELECT_CLASS}
                          value={draft.cadastroTabelaTransporteId}
                          onChange={(e) => patchDraft(row, { cadastroTabelaTransporteId: e.target.value })}
                          aria-label={`Tabela de transportes de ${row.razaoSocial}`}
                        >
                          {tabsTransporte.length === 0 ? (
                            <option value="">Sem tabela vigente</option>
                          ) : null}
                          {tabsTransporte.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.padrao ? `${t.nome} (padrão)` : t.nome}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-3">
                        <Button
                          type="button"
                          size="sm"
                          disabled={savingId === row.id || !dirtyIds.has(row.id)}
                          onClick={() => void onSalvar(row)}
                        >
                          Salvar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
