"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ApiError } from "@/lib/api/staff-client";
import {
  aprovarCadastroFinanceiro,
  CONDICAO_PAGAMENTO_PADRAO,
  displayField,
  displayInscricaoEstadual,
  fetchPendenciasCadastroCount,
  formatEnderecoLinha,
  listarCadastrosPendentes,
  listarCondicoesPagamento,
  listarPrazosPagamento,
  rejeitarCadastroFinanceiro,
  validacaoDominioBadge,
  type CadastroPendenteRow,
  type CondicaoPagamentoAprovacao,
} from "@/lib/api/cadastro-financeiro-client";
import {
  isCondicaoPagamentoApiValue,
  OPCOES_CONDICAO_PAGAMENTO,
  prazosDaForma,
  toCondicaoPagamentoApiValue,
  type CondicaoPagamentoOption,
} from "@/lib/condicao-pagamento-portal";
import { cn } from "@/lib/utils";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { toast } from "@/lib/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCpfCnpjBr } from "@/lib/format-cpf-cnpj-br";
import { formatCepBr } from "@/lib/nfse/cliente-fiscal";
import { usePendenciasCadastroStore } from "@/stores/pendencias-cadastro-store";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

function EmpresaDisclosurePanel({ row }: { row: CadastroPendenteRow }) {
  return (
    <div className="mt-2 grid grid-cols-12 gap-x-4 gap-y-2 rounded-md bg-zinc-900/60 p-3">
      <div className="col-span-12 md:col-span-4">
        <p className="text-xs text-zinc-500">Razão Social</p>
        <p className="text-sm font-medium text-zinc-200">{displayField(row.razaoSocial)}</p>
      </div>
      <div className="col-span-12 md:col-span-4">
        <p className="text-xs text-zinc-500">Nome Fantasia</p>
        <p className="text-sm font-medium text-zinc-200">{displayField(row.nomeFantasia)}</p>
      </div>
      <div className="col-span-12 md:col-span-4">
        <p className="text-xs text-zinc-500">CNPJ</p>
        <p className="text-sm font-medium text-zinc-200">{formatCpfCnpjBr(row.cpfCnpj)}</p>
      </div>
      <div className="col-span-6 md:col-span-2">
        <p className="text-xs text-zinc-500">Inscrição Estadual</p>
        <p className="text-sm font-medium text-zinc-200">{displayInscricaoEstadual(row)}</p>
      </div>
      <div className="col-span-6 md:col-span-2">
        <p className="text-xs text-zinc-500">Inscrição Municipal</p>
        <p className="text-sm font-medium text-zinc-200">{displayField(row.inscricaoMunicipal)}</p>
      </div>
      <div className="col-span-12 md:col-span-4">
        <p className="text-xs text-zinc-500">Endereço</p>
        <p className="text-sm font-medium text-zinc-200">{formatEnderecoLinha(row)}</p>
      </div>
      <div className="col-span-6 md:col-span-2">
        <p className="text-xs text-zinc-500">Cidade / UF</p>
        <p className="text-sm font-medium text-zinc-200">
          {displayField(row.enderecoCidade)} / {displayField(row.enderecoUf)}
        </p>
      </div>
      <div className="col-span-6 md:col-span-2">
        <p className="text-xs text-zinc-500">CEP</p>
        <p className="text-sm font-medium text-zinc-200">
          {row.enderecoCep ? formatCepBr(row.enderecoCep) : "—"}
        </p>
      </div>
    </div>
  );
}

export default function CadastrosPendentesPage() {
  const user = useStaffAuthStore((s) => s.user);
  const ok = user?.role === "ADMIN" || user?.role === "GERENTE";
  const [rows, setRows] = useState<CadastroPendenteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectRow, setRejectRow] = useState<CadastroPendenteRow | null>(null);
  const [rejectMotivo, setRejectMotivo] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [condicaoSelecionada, setCondicaoSelecionada] =
    useState<CondicaoPagamentoAprovacao>(CONDICAO_PAGAMENTO_PADRAO);
  const [prazoSelecionado, setPrazoSelecionado] = useState("30_DIAS");
  const [opcoesCondicao, setOpcoesCondicao] = useState<CondicaoPagamentoOption[]>([
    ...OPCOES_CONDICAO_PAGAMENTO,
  ]);
  const [opcoesPrazo, setOpcoesPrazo] = useState<
    Array<{ label: string; value: string; formaVinculada?: string | null }>
  >([]);
  const decrementPendencias = usePendenciasCadastroStore((s) => s.decrement);
  const setPendenciasCount = usePendenciasCadastroStore((s) => s.setCount);

  const load = useCallback(async () => {
    if (!ok) return;
    setLoading(true);
    try {
      const [list, count] = await Promise.all([listarCadastrosPendentes(), fetchPendenciasCadastroCount()]);
      setRows(list);
      setPendenciasCount(count);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao carregar cadastros pendentes");
    } finally {
      setLoading(false);
    }
  }, [ok, setPendenciasCount]);

  useEffect(() => {
    if (!ok) return;
    void Promise.all([listarCondicoesPagamento(), listarPrazosPagamento()])
      .then(([opcoes, prazos]) => {
        if (opcoes.length) {
          setOpcoesCondicao(opcoes);
          setCondicaoSelecionada((prev) =>
            isCondicaoPagamentoApiValue(prev, opcoes) ? prev : toCondicaoPagamentoApiValue(prev, opcoes),
          );
        }
        if (prazos.length) {
          setOpcoesPrazo(prazos);
          setPrazoSelecionado((prev) => (prazos.some((p) => p.value === prev) ? prev : prazos[0].value));
        }
      })
      .catch(() => {
        /* fallback estático */
      });
  }, [ok]);

  useEffect(() => {
    void load();
  }, [load]);

  const prazosFiltrados = useMemo(() => {
    const base = opcoesPrazo.length
      ? opcoesPrazo
      : [{ label: "30 dias", value: "30_DIAS", formaVinculada: "FATURAMENTO" }];
    return prazosDaForma(base, condicaoSelecionada);
  }, [opcoesPrazo, condicaoSelecionada]);

  useEffect(() => {
    if (!prazosFiltrados.length) return;
    if (prazosFiltrados.some((p) => p.value === prazoSelecionado)) return;
    setPrazoSelecionado(prazosFiltrados[0].value);
  }, [prazosFiltrados, prazoSelecionado]);

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onAprovar(row: CadastroPendenteRow) {
    const prazo = prazoSelecionado.trim();
    if (!prazo) {
      toast.error("Selecione o prazo comercial (calendário de boletos).");
      return;
    }
    const vinculo = opcoesPrazo.find((p) => p.value === prazo)?.formaVinculada;
    const condicaoApi = toCondicaoPagamentoApiValue(
      vinculo && isCondicaoPagamentoApiValue(vinculo, opcoesCondicao) ? vinculo : condicaoSelecionada,
      opcoesCondicao,
    );
    setActionId(row.id);
    try {
      await aprovarCadastroFinanceiro(row.id, condicaoApi, prazo);
      decrementPendencias();
      toast.success(
        `Cliente ${row.razaoSocial} aprovado. Prazo: ${opcoesPrazo.find((p) => p.value === prazo)?.label ?? prazo}.`,
      );
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao aprovar cadastro");
    } finally {
      setActionId(null);
    }
  }

  async function onRejeitar() {
    if (!rejectRow) return;
    const motivo = rejectMotivo.trim();
    if (!motivo) {
      toast.error("Informe o motivo da rejeição.");
      return;
    }
    setActionId(rejectRow.id);
    try {
      await rejeitarCadastroFinanceiro(rejectRow.id, motivo);
      decrementPendencias();
      toast.success("Cadastro rejeitado.");
      setRejectRow(null);
      setRejectMotivo("");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao rejeitar cadastro");
    } finally {
      setActionId(null);
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
        <h1 className="text-2xl font-semibold text-white">Novos cadastros pendentes</h1>
        <p className="mt-1 text-sm text-zinc-400">
          O cliente já opera à vista (PIX) enquanto aguarda análise. A aprovação define prazo e forma
          de faturamento (parcelas do boleto).
        </p>
      </div>

      <Card className="border-zinc-800 bg-zinc-950/80">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base text-zinc-100">Fila de análise financeira</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            Atualizar
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading && rows.length === 0 ? (
            <p className="text-sm text-zinc-500">Carregando…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhum cadastro pendente no momento.</p>
          ) : (
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-2 py-3 font-medium">Empresa</th>
                  <th className="px-2 py-3 font-medium">CNPJ</th>
                  <th className="px-2 py-3 font-medium">E-mail</th>
                  <th className="px-2 py-3 font-medium">Cadastro</th>
                  <th className="px-2 py-3 font-medium">Domínio</th>
                  <th className="px-2 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const expanded = expandedIds.has(row.id);
                  return (
                    <Fragment key={row.id}>
                      <tr className="border-b border-zinc-900/80 align-top">
                        <td className="px-2 py-3 text-zinc-200">
                          <button
                            type="button"
                            className="flex w-full items-start gap-1.5 text-left"
                            onClick={() => toggleExpanded(row.id)}
                            aria-expanded={expanded}
                          >
                            {expanded ? (
                              <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                            ) : (
                              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                            )}
                            <span className="min-w-0">
                              <span className="font-medium hover:text-white">{row.razaoSocial}</span>
                              {row.nomeFantasia ? (
                                <span className="mt-0.5 block text-xs text-zinc-500">{row.nomeFantasia}</span>
                              ) : null}
                            </span>
                          </button>
                        </td>
                        <td className="px-2 py-3 font-mono text-xs text-zinc-300">
                          {formatCpfCnpjBr(row.cpfCnpj)}
                        </td>
                        <td className="px-2 py-3 text-zinc-300">{row.email}</td>
                        <td className="px-2 py-3 text-zinc-400">{formatDate(row.createdAt)}</td>
                        <td className="px-2 py-3 text-zinc-300">{validacaoDominioBadge(row.validacaoDominio)}</td>
                        <td className="px-2 py-3">
                          <div className="flex min-w-[280px] flex-col gap-2 sm:flex-row sm:items-end">
                            <label className="flex min-w-[140px] flex-col gap-1">
                              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                                Forma
                              </span>
                              <select
                                className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white"
                                value={condicaoSelecionada}
                                onChange={(e) => {
                                  const next = e.target.value;
                                  setCondicaoSelecionada(
                                    isCondicaoPagamentoApiValue(next, opcoesCondicao)
                                      ? next
                                      : toCondicaoPagamentoApiValue(next, opcoesCondicao),
                                  );
                                }}
                                aria-label="Forma de pagamento"
                              >
                                {opcoesCondicao.map((item) => (
                                  <option key={item.value} value={item.value}>
                                    {item.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex min-w-[140px] flex-col gap-1">
                              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                                Prazo
                              </span>
                              <select
                                className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white"
                                value={prazoSelecionado}
                                onChange={(e) => setPrazoSelecionado(e.target.value)}
                                aria-label="Prazo de pagamento"
                              >
                                {prazosFiltrados.map((item) => (
                                  <option key={item.value} value={item.value}>
                                    {item.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <Button
                              type="button"
                              size="sm"
                              className={cn("bg-emerald-700 hover:bg-emerald-600")}
                              disabled={actionId === row.id}
                              onClick={() => void onAprovar(row)}
                            >
                              Aprovar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-red-700 text-red-300 hover:bg-red-950"
                              disabled={actionId === row.id}
                              onClick={() => {
                                setRejectRow(row);
                                setRejectMotivo("");
                              }}
                            >
                              Rejeitar
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="border-b border-zinc-900/80">
                          <td colSpan={6} className="px-2 pb-3 pt-0">
                            <EmpresaDisclosurePanel row={row} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={rejectRow !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectRow(null);
            setRejectMotivo("");
          }
        }}
      >
        <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Rejeitar cadastro</DialogTitle>
            <DialogDescription className="text-zinc-400">
              {rejectRow
                ? `Informe o motivo da rejeição de ${rejectRow.razaoSocial}. O cliente não poderá operar no portal.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <textarea
            className="min-h-[96px] w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
            placeholder="Motivo da rejeição (obrigatório)"
            value={rejectMotivo}
            onChange={(e) => setRejectMotivo(e.target.value)}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRejectRow(null);
                setRejectMotivo("");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-red-700 text-red-300 hover:bg-red-950"
              disabled={!rejectRow || actionId === rejectRow.id}
              onClick={() => void onRejeitar()}
            >
              Confirmar rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
