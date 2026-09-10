"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  type PortalPatioSaldoItem,
  type PortalPatioSaldoResponse,
} from "@/lib/api/portal-client";
import { formatTipoTamanhoContainerLabel } from "@/lib/cadastros/tipo-container-tamanhos";
import { formatDate, solicitacaoProtocoloDisplay } from "@/lib/portal-tracking";
import { toast } from "@/lib/toast";
import { PatioSolicitarSaidaButton } from "@/components/portal/patio-solicitar-saida-button";

function diasLabel(n: number): string {
  if (n <= 0) return "Hoje";
  if (n === 1) return "1 dia";
  return `${n} dias`;
}

function cargaLabel(status: PortalPatioSaldoItem["statusContainer"]): string {
  if (status === "CHEIO") return "Cheio";
  if (status === "VAZIO") return "Vazio";
  return "—";
}

function equipamentoLabel(item: PortalPatioSaldoItem): string {
  return formatTipoTamanhoContainerLabel(item.tipo, item.tamanho) ?? item.tipo ?? "—";
}

function matchesQuery(item: PortalPatioSaldoItem, q: string): boolean {
  const needle = q.trim().toLowerCase().replace(/[\s-]/g, "");
  if (!needle) return true;
  const hay = [
    item.unidadeIso,
    item.booking,
    item.processo,
    item.protocolo,
    item.unidadeProcessoLabel,
    item.tipo,
    item.tamanho,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[\s-]/g, "");
  return hay.includes(needle);
}

export default function PortalPatioSaldoPage() {
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<PortalPatioSaldoResponse | null>(null);

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
    return items.filter((item) => matchesQuery(item, query));
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
          title="Saldo no pátio"
          description="Unidades da sua empresa atualmente depositadas na RL Transportes."
        />
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
          title="Saldo no pátio"
          description="Unidades da sua empresa atualmente depositadas na RL Transportes."
        />
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

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
          placeholder="Buscar unidade, booking ou protocolo"
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
                    { key: "unidade", header: "Unidade" },
                    { key: "id", header: "ID" },
                    { key: "tipo", header: "Tipo" },
                    { key: "carga", header: "Carga" },
                    { key: "booking", header: "Booking" },
                    { key: "dias", header: "Dias" },
                    { key: "status", header: "Situação" },
                    { key: "protocolo", header: "Solicitação" },
                    { key: "saida", header: "" },
                  ]}
                  rows={filtered}
                  getRowKey={(r) => r.id}
                  emptyText="Nenhuma unidade encontrada com a busca atual."
                  renderCell={(r, key) => {
                    if (key === "unidade") {
                      return (
                        <ContainerNumber value={r.unidadeIso} showLabel={false} size="sm" />
                      );
                    }
                    if (key === "id") {
                      return (
                        <span className="font-mono text-sm text-[var(--accent)]">
                          {r.unidadeProcessoLabel || "—"}
                        </span>
                      );
                    }
                    if (key === "tipo") {
                      return (
                        <span className="text-slate-200">
                          {equipamentoLabel(r)}
                          {r.refrigerado ? (
                            <span className="ml-2 text-xs text-sky-300">Reefer</span>
                          ) : null}
                        </span>
                      );
                    }
                    if (key === "carga") return cargaLabel(r.statusContainer);
                    if (key === "booking") return r.booking || r.processo || "—";
                    if (key === "dias") {
                      return (
                        <span className="tabular-nums" title={formatDate(r.entradaEm)}>
                          {diasLabel(r.diasNoPatio)}
                        </span>
                      );
                    }
                    if (key === "status") {
                      return <RawStatusBadge label={r.statusPatio} variant="secondary" />;
                    }
                    if (key === "saida") {
                      return r.unidadeProcessoNumero ? (
                        <PatioSolicitarSaidaButton item={r} />
                      ) : null;
                    }
                    return (
                      <Link
                        href={`/portal/solicitacoes/${r.solicitacaoId}`}
                        className="font-mono text-sm text-[var(--accent)] hover:underline"
                      >
                        {solicitacaoProtocoloDisplay(r.protocolo)}
                      </Link>
                    );
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
                        <Link href={`/portal/solicitacoes/${r.solicitacaoId}`}>
                          <ContainerNumber value={r.unidadeIso} showLabel={false} size="md" />
                        </Link>
                        <RawStatusBadge label={r.statusPatio} variant="secondary" />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-slate-500">ID</p>
                          <p className="font-mono text-slate-200">{r.unidadeProcessoLabel || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Tipo</p>
                          <p className="text-slate-200">{equipamentoLabel(r)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Carga</p>
                          <p className="text-slate-200">{cargaLabel(r.statusContainer)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Booking</p>
                          <p className="truncate text-slate-200">{r.booking || r.processo || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">No pátio</p>
                          <p className="text-slate-200">{diasLabel(r.diasNoPatio)}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/portal/solicitacoes/${r.solicitacaoId}`}
                          className="font-mono text-xs text-[var(--accent)] hover:underline"
                        >
                          Solicitação {solicitacaoProtocoloDisplay(r.protocolo)}
                        </Link>
                        {r.unidadeProcessoNumero ? (
                          <PatioSolicitarSaidaButton item={r} />
                        ) : null}
                      </div>
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
