"use client";

import { useMemo } from "react";
import type { GateTurno } from "@/lib/gate/gate-cockpit-types";
import { matchesTurno } from "@/lib/gate/gate-cockpit-utils";
import { useGateCockpitContext } from "@/components/gate/cockpit/gate-cockpit-context";
import { matchBusca } from "@/components/gate/cockpit/gate-cockpit-layout";

export function useGateFilteredData() {
  const { data, filters, refresh, loading, lastSync } = useGateCockpitContext();
  const { turno, busca, filtroOsStatus } = filters;

  const fila = useMemo(
    () =>
      (data?.filaChegada ?? []).filter(
        (r) =>
          matchesTurno(r.chegadaEm, turno) &&
          matchBusca(busca, r.placa, r.containersIso),
      ),
    [data?.filaChegada, turno, busca],
  );

  const operacao = useMemo(
    () =>
      (data?.operacaoAtiva ?? []).filter(
        (r) =>
          (!r.entradaEm || matchesTurno(r.entradaEm, turno)) &&
          matchBusca(busca, r.placa, r.containersIso),
      ),
    [data?.operacaoAtiva, turno, busca],
  );

  const despacho = useMemo(
    () =>
      (data?.despacho ?? []).filter(
        (r) =>
          matchesTurno(r.prontoDesde, turno) &&
          matchBusca(busca, r.placa, r.containersIso),
      ),
    [data?.despacho, turno, busca],
  );

  const patioUnidades = useMemo(
    () =>
      (data?.patio.unidades ?? []).filter((u) => matchBusca(busca, null, [u.container])),
    [data?.patio.unidades, busca],
  );

  const ordens = useMemo(() => {
    let rows = data?.ordensServico ?? [];
    if (turno !== "TODOS") rows = rows.filter((r) => r.turno === turno);
    if (filtroOsStatus !== "TODOS") rows = rows.filter((r) => r.osStatus === filtroOsStatus);
    rows = rows.filter((r) => matchBusca(busca, r.placa, r.containersIso));
    return rows;
  }, [data?.ordensServico, turno, filtroOsStatus, busca]);

  return {
    data,
    loading,
    lastSync,
    refresh,
    fila,
    operacao,
    despacho,
    patioUnidades,
    ordens,
    turno: turno as GateTurno,
    filtroOsStatus,
  };
}
