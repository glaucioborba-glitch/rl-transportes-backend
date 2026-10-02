"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionTitle } from "@/components/portal/portal-primitives";
import { ContainerNumber } from "@/components/ui/container-number";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ApiError,
  fetchSimulacaoValoresCatalogo,
  simularValoresPortal,
  type PortalSimulacaoLote,
  type PortalSimulacaoUnidade,
} from "@/lib/api/portal-client";
import { formatTipoTamanhoContainerLabel } from "@/lib/cadastros/tipo-container-tamanhos";
import { formatIsoDisplay } from "@/lib/container-display";
import { formatBRL } from "@/lib/financeiro/format";
import { formatDate } from "@/lib/portal-tracking";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const AVISO_PADRAO =
  "Os valores são previsões com base na pré-fatura e na data de saída informada. Podem sofrer alterações até o gate-out (energia de tomada, shifting, serviços executados no pátio ou tabela vigente).";

function todayLocalIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function unidadeMeta(item: PortalSimulacaoUnidade): string {
  const tipo = formatTipoTamanhoContainerLabel(item.tipo, item.tamanho) ?? item.tipo;
  return `${tipo}${item.refrigerado ? " · Reefer" : ""}`;
}

export default function PortalSimulacaoValoresPage() {
  const [loading, setLoading] = useState(true);
  const [unidades, setUnidades] = useState<PortalSimulacaoUnidade[]>([]);
  const [avisoCatalogo, setAvisoCatalogo] = useState(AVISO_PADRAO);
  const [busca, setBusca] = useState("");
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [dataSaida, setDataSaida] = useState(todayLocalIso);
  const [simulando, setSimulando] = useState(false);
  const [lote, setLote] = useState<PortalSimulacaoLote | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSimulacaoValoresCatalogo();
      setUnidades(data.unidades);
      if (data.aviso) setAvisoCatalogo(data.aviso);
      setSelecionadas((prev) => prev.filter((id) => data.unidades.some((u) => u.id === id)));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível carregar a simulação.");
      setUnidades([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visiveis = useMemo(() => {
    const needle = busca.trim().toLowerCase().replace(/[\s-]/g, "");
    if (!needle) return unidades;
    return unidades.filter((u) => {
      const hay = [u.unidadeIso, u.protocolo, u.tipo, u.tamanho, u.unidadeProcessoLabel]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .replace(/[\s-]/g, "");
      return hay.includes(needle);
    });
  }, [unidades, busca]);

  const minEntrada = useMemo(() => {
    const datas = selecionadas
      .map((id) => unidades.find((u) => u.id === id)?.entradaEm.slice(0, 10))
      .filter((d): d is string => Boolean(d));
    if (!datas.length) return undefined;
    return datas.reduce((a, b) => (a < b ? a : b));
  }, [selecionadas, unidades]);

  function toggle(id: string) {
    setSelecionadas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setLote(null);
  }

  function toggleTodasVisiveis() {
    const ids = visiveis.map((u) => u.id);
    const todas = ids.length > 0 && ids.every((id) => selecionadas.includes(id));
    setSelecionadas((prev) => {
      if (todas) return prev.filter((id) => !ids.includes(id));
      return [...new Set([...prev, ...ids])];
    });
    setLote(null);
  }

  async function onSimular() {
    if (!selecionadas.length) {
      toast.error("Selecione ao menos uma unidade no pátio.");
      return;
    }
    if (!dataSaida) {
      toast.error("Informe a data de saída.");
      return;
    }
    setSimulando(true);
    try {
      const r = await simularValoresPortal({
        unidadeIds: selecionadas,
        dataSaida,
      });
      setLote(r);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível simular o valor.");
      setLote(null);
    } finally {
      setSimulando(false);
    }
  }

  if (loading && !unidades.length) {
    return (
      <main className="mx-auto w-[90%] px-4 py-8">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  const todasVisiveisMarcadas =
    visiveis.length > 0 && visiveis.every((u) => selecionadas.includes(u.id));

  return (
    <main className="mx-auto w-[90%] space-y-6 px-4 py-8">
      <SectionTitle
        title="Simulação de valores"
        description="Use o valor já lançado na pré-fatura e projete até a data de saída. Nada é faturado nesta tela."
      />

      <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-100/90">
        {avisoCatalogo}
      </p>

      {unidades.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-slate-400">
              Nenhuma unidade depositada no pátio no momento. A simulação usa as unidades em{" "}
              <Link href="/portal/patio" className="text-[var(--accent)] hover:underline">
                consulta de estoque
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardContent className="space-y-5 py-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-[12rem] flex-1 space-y-2">
                  <Label htmlFor="buscaUnidade">Unidades no pátio</Label>
                  <Input
                    id="buscaUnidade"
                    placeholder="Buscar ISO, protocolo ou ID…"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={toggleTodasVisiveis}>
                  {todasVisiveisMarcadas ? "Limpar seleção" : "Selecionar visíveis"}
                </Button>
              </div>

              <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                {visiveis.map((u) => {
                  const checked = selecionadas.includes(u.id);
                  return (
                    <li key={u.id}>
                      <label
                        className={cn(
                          "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-sm transition-colors",
                          checked
                            ? "border-[var(--accent)]/40 bg-[var(--accent)]/10"
                            : "border-white/10 hover:border-white/20",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
                          checked={checked}
                          onChange={() => toggle(u.id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <ContainerNumber value={formatIsoDisplay(u.unidadeIso)} showLabel={false} size="sm" />
                            <span className="text-xs text-slate-500">{unidadeMeta(u)}</span>
                          </span>
                          <span className="mt-1 block text-xs text-slate-500">
                            Entrada {formatDate(u.entradaEm)} · {u.diasNoPatio}{" "}
                            {u.diasNoPatio === 1 ? "dia" : "dias"} no pátio
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-[10px] uppercase tracking-widest text-slate-500">
                            Já lançado
                          </span>
                          <span className="tabular-nums text-slate-100">
                            {formatBRL(u.valorLancado ?? 0)}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>

              <div className="space-y-2">
                <Label htmlFor="dataSaida">Data de saída (todas as selecionadas)</Label>
                <Input
                  id="dataSaida"
                  type="date"
                  value={dataSaida}
                  min={minEntrada}
                  onChange={(e) => {
                    setDataSaida(e.target.value);
                    setLote(null);
                  }}
                />
              </div>

              <Button onClick={() => void onSimular()} disabled={simulando || selecionadas.length === 0}>
                <Calculator className="mr-2 h-4 w-4" />
                {simulando
                  ? "Calculando…"
                  : selecionadas.length > 1
                    ? `Simular ${selecionadas.length} unidades`
                    : "Simular valor"}
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardContent className="space-y-4 py-6">
              {!lote ? (
                <p className="text-sm text-slate-500">
                  Selecione as unidades e a data de saída. O detalhamento individual e o total aparecem aqui.
                  Nada é faturado nesta tela.
                </p>
              ) : (
                <>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">Previsão no total</p>
                    <p className="mt-1 text-3xl font-semibold tabular-nums text-white">
                      {formatBRL(lote.totalGeral)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Já lançado hoje: {formatBRL(lote.valorLancadoGeral)} · {lote.unidades.length}{" "}
                      {lote.unidades.length === 1 ? "unidade" : "unidades"} · saída {formatDate(lote.dataSaida)}
                    </p>
                  </div>

                  <ul className="space-y-4">
                    {lote.unidades.map((r) => (
                      <li
                        key={r.unidade.id}
                        className="rounded-lg border border-white/10 bg-black/20 px-3 py-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <ContainerNumber
                              value={formatIsoDisplay(r.unidade.unidadeIso)}
                              showLabel={false}
                              size="sm"
                            />
                            <p className="mt-1 text-xs text-slate-500">
                              {r.diasNoPatio} dias no pátio · {r.diasFreeTime} de free time ·{" "}
                              {r.diasFaturaveis} faturáveis
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-widest text-slate-500">Previsão</p>
                            <p className="text-lg font-semibold tabular-nums text-white">
                              {formatBRL(r.total)}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Lançado {formatBRL(r.valorLancado)}
                            </p>
                          </div>
                        </div>
                        <ul className="mt-2 divide-y divide-white/10 border-t border-white/10">
                          {r.itens.map((item, i) => (
                            <li
                              key={`${item.descricao}-${i}`}
                              className="flex items-start justify-between gap-3 py-2 text-sm"
                            >
                              <span className="text-slate-300">
                                {item.descricao}
                                <span className="block text-[11px] text-slate-500">
                                  {item.origem === "PRE_FATURA" ? "Já lançado na pré-fatura" : "Previsão até a saída"}
                                  {item.detalheCobranca ? ` · ${item.detalheCobranca}` : ""}
                                  {!item.detalheCobranca && item.quantidade > 1
                                    ? ` · ${item.quantidade} × ${formatBRL(item.valorUnitario)}`
                                    : ""}
                                </span>
                              </span>
                              <span className="shrink-0 tabular-nums text-slate-100">
                                {formatBRL(item.valorTotal)}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {r.avisos.length > 0 ? (
                          <ul className="mt-2 space-y-1 text-xs text-amber-200/90">
                            {r.avisos.map((a) => (
                              <li key={a}>{a}</li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ul>

                  <div className="flex items-center justify-between border-t border-white/10 pt-3 text-sm">
                    <span className="text-slate-400">Total previsto</span>
                    <span className="text-lg font-semibold tabular-nums text-white">
                      {formatBRL(lote.totalGeral)}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
