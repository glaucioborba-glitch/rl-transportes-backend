"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Container, RefreshCw, Search, Ship, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KpiCard, SectionTitle } from "@/components/portal/portal-primitives";
import { RawStatusBadge } from "@/components/portal/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ContainerNumber } from "@/components/ui/container-number";
import {
  ApiError,
  fetchPatioSaldo,
  type PortalPatioSaldoItem,
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
  patioDataAgendamentoLabel,
  patioEquipamentoLabel,
  patioHoraJanelaLabel,
  patioSaldoMatchesQuery,
  ORGANIZADOR_EMBARQUE_HREF,
} from "@/lib/portal-patio-display";

function diasLabel(n: number): string {
  if (n <= 0) return "Hoje";
  if (n === 1) return "1 dia";
  return `${n} dias`;
}

function PatioField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 truncate text-base font-medium text-slate-100">{value || "—"}</div>
    </div>
  );
}

function PatioUnidadeCard({
  r,
  tipos,
  onChanged,
}: {
  r: PortalPatioSaldoItem;
  tipos: ReturnType<typeof usePortalTiposContainer>["tipos"];
  onChanged: () => void;
}) {
  const requerTomada = tipoRequerTomadaReefer(tipos, r.tipo);
  return (
    <Card className="transition-colors hover:border-white/20">
      <CardContent className="flex flex-col gap-5 px-5 py-4 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1 space-y-5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4 xl:grid-cols-8">
            <PatioField label="ID" value={<PatioIdLink item={r} />} />
            <PatioField
              label="Unidade"
              value={<ContainerNumber value={r.unidadeIso} showLabel={false} size="sm" />}
            />
            <PatioField label="Tipo" value={patioEquipamentoLabel(r)} />
            <PatioField
              label="Tomada"
              value={
                requerTomada ? (
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
                      requerTomada
                      liberarPedido={Boolean(r.unidadeProcessoNumero)}
                      onChanged={onChanged}
                    />
                  </div>
                ) : (
                  "—"
                )
              }
            />
            <PatioField label="Carga" value={patioCargaLabel(r.statusContainer)} />
            <PatioField
              label="Situação"
              value={<RawStatusBadge label={r.statusPatio} variant="secondary" />}
            />
            <PatioField
              label="Entrada"
              value={<span className="tabular-nums">{formatDate(r.entradaEm)}</span>}
            />
            <PatioField
              label="Dias"
              value={<span className="tabular-nums">{diasLabel(r.diasNoPatio)}</span>}
            />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 xl:grid-cols-6">
            <PatioField label="Booking" value={r.booking?.trim() || "—"} />
            <PatioField label="Processo" value={r.processo?.trim() || "—"} />
            <PatioField label="Navio" value={r.navio?.trim() || "—"} />
            <PatioField label="Local de destino" value={r.localDestino?.trim() || "—"} />
            <PatioField label="Data" value={patioDataAgendamentoLabel(r.dataAgendamento) || "—"} />
            <PatioField label="Hora" value={patioHoraJanelaLabel(r.horaInicio, r.horaFim) || "—"} />
          </div>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-48 [&_button]:w-full">
          {r.unidadeProcessoNumero ? <PatioSolicitarSaidaButton item={r} /> : null}
          <Button variant="outline" size="sm" className="w-full justify-center gap-1.5" asChild>
            <Link href={ORGANIZADOR_EMBARQUE_HREF}>
              <Ship className="h-3.5 w-3.5" />
              Organizador
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

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
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-slate-400">
            Nenhuma unidade encontrada com a busca atual.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <PatioUnidadeCard key={r.id} r={r} tipos={tipos} onChanged={() => void load()} />
          ))}
        </div>
      )}
    </main>
  );
}
