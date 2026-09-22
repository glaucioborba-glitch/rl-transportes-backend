"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Container, RefreshCw, Search, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KpiCard, SectionTitle } from "@/components/portal/portal-primitives";
import { PortalTable } from "@/components/portal/portal-table";
import { RawStatusBadge } from "@/components/portal/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ContainerNumber } from "@/components/ui/container-number";
import {
  ApiError,
  fetchPatioSaldo,
  type PortalPatioSaldoResponse,
} from "@/lib/api/portal-client";
import { formatDate } from "@/lib/portal-tracking";
import { toast } from "@/lib/toast";
import { PatioSolicitarSaidaButton } from "@/components/portal/patio-solicitar-saida-button";
import { PortalTomadaReeferActions } from "@/components/portal/portal-tomada-reefer-actions";
import { usePortalTiposContainer } from "@/hooks/use-portal-tipos-container";
import { rotuloTomadaPedido } from "@/lib/cadastros/tomada-display";
import { TomadaPedidoBadge } from "@/components/gate/tomada-pedido-badge";
import { tipoRequerTomadaReefer } from "@/lib/cadastros/tipo-requer-tomada";
import { PatioIdLink } from "@/components/portal/patio-id-link";
import { ConsultaEstoqueSubnav } from "@/components/portal/consulta-estoque-subnav";
import {
  patioCargaLabel,
  patioEquipamentoLabel,
  patioSaldoMatchesQuery,
} from "@/lib/portal-patio-display";

function diasLabel(n: number): string {
  if (n <= 0) return "Hoje";
  if (n === 1) return "1 dia";
  return `${n} dias`;
}

const CELL = "whitespace-nowrap px-2.5 py-2 text-sm";

export default function PortalPatioSaldoPage() {
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<PortalPatioSaldoResponse | null>(null);
  const { tipos } = usePortalTiposContainer(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchPatioSaldo());
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível carregar o saldo do pátio");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    return items.filter((item) => patioSaldoMatchesQuery(item, query));
  }, [data, query]);

  if (loading && !data) {
    return (
      <main className="mx-auto w-[90%] px-4 py-8">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto w-[90%] space-y-6 px-4 py-8">
        <SectionTitle
          title="Consulta de estoque"
          description="Unidades da sua empresa atualmente depositadas na RL Transportes."
        />
        <div className="mb-2">
          <ConsultaEstoqueSubnav />
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-slate-400">Não foi possível carregar o saldo do pátio.</p>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const total = data.total;

  return (
    <main className="mx-auto w-[90%] space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle
          className="mb-0"
          title="Consulta de estoque"
          description="Unidades da sua empresa atualmente depositadas na RL Transportes."
        />
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <ConsultaEstoqueSubnav />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Unidades no pátio" value={total} icon={Container} />
        <KpiCard title="Cheios" value={data.cheios} />
        <KpiCard title="Vazios" value={data.vazios} />
        <KpiCard title="Reefer" value={data.refrigerados} icon={Snowflake} />
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar ID, unidade, booking, processo ou navio"
          className="pl-9"
          aria-label="Buscar unidades no pátio"
        />
      </div>

      {total === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-slate-400">
            Nenhuma unidade depositada no pátio no momento.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <PortalTable
                  columns={[
                    { key: "id", header: "ID", className: CELL },
                    { key: "unidade", header: "Unidade", className: CELL },
                    { key: "tipo", header: "Tipo", className: CELL },
                    { key: "tomada", header: "Tomada", className: CELL },
                    { key: "carga", header: "Carga", className: CELL },
                    { key: "status", header: "Situação", className: CELL },
                    { key: "entrada", header: "Entrada", className: CELL },
                    { key: "dias", header: "Dias", className: CELL },
                    { key: "booking", header: "Booking", className: CELL },
                    { key: "processo", header: "Processo", className: CELL },
                    { key: "navio", header: "Navio", className: CELL },
                    { key: "saida", header: "", className: `${CELL} text-right` },
                  ]}
                  rows={filtered}
                  getRowKey={(r) => r.id}
                  emptyText="Nenhuma unidade encontrada com a busca atual."
                  renderCell={(r, key) => {
                    if (key === "id") return <PatioIdLink item={r} />;
                    if (key === "unidade") {
                      return (
                        <ContainerNumber value={r.unidadeIso} showLabel={false} size="sm" />
                      );
                    }
                    if (key === "tipo") {
                      return <span className="text-slate-200">{patioEquipamentoLabel(r)}</span>;
                    }
                    if (key === "tomada") {
                      const requer = tipoRequerTomadaReefer(tipos, r.tipo);
                      if (!requer) return "—";
                      return (
                        <div className="flex items-center gap-1.5">
                          <TomadaPedidoBadge
                            label={rotuloTomadaPedido({
                              tipo: r.tipo,
                              refrigerado: r.refrigerado,
                              tipos,
                            })}
                          />
                          <PortalTomadaReeferActions
                            compact
                            unidadeIso={r.unidadeIso}
                            solicitacaoStatus="EM_PATIO"
                            tipoCodigo={r.tipo}
                            requerTomada={requer}
                            liberarPedido={Boolean(r.unidadeProcessoNumero)}
                            onChanged={() => void load()}
                          />
                        </div>
                      );
                    }
                    if (key === "carga") return patioCargaLabel(r.statusContainer);
                    if (key === "status") {
                      return <RawStatusBadge label={r.statusPatio} variant="secondary" />;
                    }
                    if (key === "entrada") {
                      return <span className="tabular-nums text-slate-200">{formatDate(r.entradaEm)}</span>;
                    }
                    if (key === "dias") {
                      return <span className="tabular-nums">{diasLabel(r.diasNoPatio)}</span>;
                    }
                    if (key === "booking") return r.booking?.trim() || "—";
                    if (key === "processo") return r.processo?.trim() || "—";
                    if (key === "navio") return r.navio?.trim() || "—";
                    if (key === "saida") {
                      return r.unidadeProcessoNumero ? (
                        <PatioSolicitarSaidaButton item={r} />
                      ) : null;
                    }
                    return null;
                  }}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 md:hidden">
            {filtered.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-slate-400">
                  Nenhuma unidade encontrada com a busca atual.
                </CardContent>
              </Card>
            ) : (
              filtered.map((r) => (
                <Card key={r.id} className="transition-colors hover:border-white/20">
                    <CardContent className="space-y-3 py-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <PatioIdLink item={r} />
                          <ContainerNumber value={r.unidadeIso} showLabel={false} size="md" />
                        </div>
                        <RawStatusBadge label={r.statusPatio} variant="secondary" />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-slate-500">Tipo</p>
                          <p className="text-slate-200">{patioEquipamentoLabel(r)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Carga</p>
                          <p className="text-slate-200">{patioCargaLabel(r.statusContainer)}</p>
                        </div>
                        {tipoRequerTomadaReefer(tipos, r.tipo) ? (
                          <div className="col-span-2">
                            <p className="text-xs text-slate-500">Tomada</p>
                            <TomadaPedidoBadge
                              label={rotuloTomadaPedido({
                                tipo: r.tipo,
                                refrigerado: r.refrigerado,
                                tipos,
                              })}
                            />
                            <PortalTomadaReeferActions
                              unidadeIso={r.unidadeIso}
                              solicitacaoStatus="EM_PATIO"
                              tipoCodigo={r.tipo}
                              requerTomada
                              liberarPedido={Boolean(r.unidadeProcessoNumero)}
                              onChanged={() => void load()}
                            />
                          </div>
                        ) : null}
                        <div>
                          <p className="text-xs text-slate-500">Entrada</p>
                          <p className="tabular-nums text-slate-200">{formatDate(r.entradaEm)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Dias</p>
                          <p className="text-slate-200">{diasLabel(r.diasNoPatio)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Booking</p>
                          <p className="truncate text-slate-200">{r.booking?.trim() || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Processo</p>
                          <p className="truncate text-slate-200">{r.processo?.trim() || "—"}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-slate-500">Navio</p>
                          <p className="truncate text-slate-200">{r.navio?.trim() || "—"}</p>
                        </div>
                      </div>
                      {r.unidadeProcessoNumero ? (
                        <div className="flex justify-end">
                          <PatioSolicitarSaidaButton item={r} />
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
              ))
            )}
          </div>
        </>
      )}
    </main>
  );
}
