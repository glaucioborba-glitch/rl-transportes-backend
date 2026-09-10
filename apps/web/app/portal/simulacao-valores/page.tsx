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
  type PortalPatioSaldoItem,
  type PortalSimulacaoResultado,
  type PortalSimulacaoServico,
} from "@/lib/api/portal-client";
import { formatTipoTamanhoContainerLabel } from "@/lib/cadastros/tipo-container-tamanhos";
import { formatBRL } from "@/lib/financeiro/format";
import { formatDate } from "@/lib/portal-tracking";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const selectCls =
  "flex h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50";

function todayLocalIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function unidadeLabel(item: PortalPatioSaldoItem): string {
  const tipo = formatTipoTamanhoContainerLabel(item.tipo, item.tamanho) ?? item.tipo;
  return `${item.unidadeIso} · ${tipo}`;
}

export default function PortalSimulacaoValoresPage() {
  const [loading, setLoading] = useState(true);
  const [unidades, setUnidades] = useState<PortalPatioSaldoItem[]>([]);
  const [servicos, setServicos] = useState<PortalSimulacaoServico[]>([]);
  const [unidadeId, setUnidadeId] = useState("");
  const [dataSaida, setDataSaida] = useState(todayLocalIso);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [simulando, setSimulando] = useState(false);
  const [resultado, setResultado] = useState<PortalSimulacaoResultado | null>(null);

  const load = useCallback(async (id?: string) => {
    setLoading(true);
    try {
      const data = await fetchSimulacaoValoresCatalogo(id);
      setUnidades(data.unidades);
      setServicos(data.servicos);
      setUnidadeId((prev) => {
        if (id && data.unidades.some((u) => u.id === id)) return id;
        if (prev && data.unidades.some((u) => u.id === prev)) return prev;
        return data.unidades[0]?.id ?? "";
      });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível carregar a simulação.");
      setUnidades([]);
      setServicos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!unidadeId) return;
    void fetchSimulacaoValoresCatalogo(unidadeId)
      .then((data) => setServicos(data.servicos))
      .catch(() => undefined);
  }, [unidadeId]);

  const unidade = useMemo(
    () => unidades.find((u) => u.id === unidadeId) ?? null,
    [unidades, unidadeId],
  );

  function toggleServico(codigo: string) {
    setEscolhidos((prev) => (prev.includes(codigo) ? prev.filter((c) => c !== codigo) : [...prev, codigo]));
    setResultado(null);
  }

  async function onSimular() {
    if (!unidadeId) {
      toast.error("Selecione uma unidade no pátio.");
      return;
    }
    if (!dataSaida) {
      toast.error("Informe a data de saída.");
      return;
    }
    setSimulando(true);
    try {
      const r = await simularValoresPortal({
        unidadeId,
        dataSaida,
        servicos: escolhidos,
      });
      setResultado(r);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível simular o valor.");
      setResultado(null);
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

  return (
    <main className="mx-auto w-[90%] space-y-6 px-4 py-8">
      <SectionTitle
        title="Simulação de valores"
        description="Escolha uma unidade da sua empresa, a data prevista de saída e os serviços extras. O valor é uma estimativa com a tabela vigente — o valor final é confirmado no gate-out."
      />

      {unidades.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-slate-400">
              Nenhuma unidade depositada no pátio no momento. A simulação usa as unidades em{" "}
              <Link href="/portal/patio" className="text-[var(--accent)] hover:underline">
                Saldo no pátio
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardContent className="space-y-5 py-6">
              <div className="space-y-2">
                <Label htmlFor="unidade">Unidade</Label>
                <select
                  id="unidade"
                  className={selectCls}
                  value={unidadeId}
                  onChange={(e) => {
                    setUnidadeId(e.target.value);
                    setResultado(null);
                  }}
                >
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id} className="bg-zinc-950">
                      {unidadeLabel(u)}
                    </option>
                  ))}
                </select>
                {unidade ? (
                  <p className="text-xs text-slate-500">
                    Entrada em {formatDate(unidade.entradaEm)} · {unidade.diasNoPatio}{" "}
                    {unidade.diasNoPatio === 1 ? "dia" : "dias"} no pátio
                    {unidade.refrigerado ? " · Reefer" : ""}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dataSaida">Data de saída</Label>
                <Input
                  id="dataSaida"
                  type="date"
                  value={dataSaida}
                  min={unidade?.entradaEm.slice(0, 10)}
                  onChange={(e) => {
                    setDataSaida(e.target.value);
                    setResultado(null);
                  }}
                />
              </div>

              <div className="space-y-3">
                <Label>Serviços adicionais</Label>
                {servicos.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Nenhum serviço extra cadastrado na tabela vigente. A simulação considera armazenagem, handling e
                    energia (se reefer).
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {servicos.map((s) => {
                      const checked = escolhidos.includes(s.codigo);
                      return (
                        <li key={s.codigo}>
                          <label
                            className={cn(
                              "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-sm transition-colors",
                              checked
                                ? "border-[var(--accent)]/40 bg-[var(--accent)]/10"
                                : "border-white/10 hover:border-white/20",
                            )}
                          >
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={checked}
                              onChange={() => toggleServico(s.codigo)}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium text-slate-100">{s.nome}</span>
                              <span className="block text-xs text-slate-500">
                                {s.descricao || s.unidadeCobrancaLabel}
                                {s.valorEstimado != null ? ` · ${formatBRL(s.valorEstimado)}` : ""}
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <Button onClick={() => void onSimular()} disabled={simulando || !unidadeId}>
                <Calculator className="mr-2 h-4 w-4" />
                {simulando ? "Calculando…" : "Simular valor"}
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardContent className="space-y-4 py-6">
              {!resultado ? (
                <p className="text-sm text-slate-500">
                  O detalhamento aparece aqui depois de simular. Nada é faturado nesta tela.
                </p>
              ) : (
                <>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">Estimativa</p>
                    <p className="mt-1 text-3xl font-semibold tabular-nums text-white">{formatBRL(resultado.total)}</p>
                    <div className="mt-2">
                      <ContainerNumber value={resultado.unidade.unidadeIso} showLabel={false} size="sm" />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {resultado.diasNoPatio} dias no pátio · {resultado.diasFreeTime} de free time ·{" "}
                      {resultado.diasFaturaveis} faturáveis
                    </p>
                  </div>

                  <ul className="divide-y divide-white/10 border-y border-white/10">
                    {resultado.itens.map((item, i) => (
                      <li key={`${item.descricao}-${i}`} className="flex items-start justify-between gap-3 py-2 text-sm">
                        <span className="text-slate-300">
                          {item.descricao}
                          {item.detalheCobranca ? (
                            <span className="block text-xs text-slate-500">{item.detalheCobranca}</span>
                          ) : item.quantidade > 1 ? (
                            <span className="block text-xs text-slate-500">
                              {item.quantidade} × {formatBRL(item.valorUnitario)}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 tabular-nums text-slate-100">{formatBRL(item.valorTotal)}</span>
                      </li>
                    ))}
                  </ul>

                  {resultado.avisos.length > 0 ? (
                    <ul className="space-y-1 text-xs text-amber-200/90">
                      {resultado.avisos.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  ) : null}

                  <p className="text-xs text-slate-500">
                    Estimativa com a tabela vigente. O valor cobrado pode variar se houver shifting, energia de tomada
                    ou serviços executados no pátio.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
