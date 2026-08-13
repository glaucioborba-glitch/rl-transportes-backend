"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useGateCockpit } from "@/hooks/use-gate-cockpit";
import type { GateCockpitPayload, GateTurno } from "@/lib/gate/gate-cockpit-types";

export type GateCockpitFilters = {
  turno: GateTurno;
  busca: string;
  dataRef: string;
  showNotifs: boolean;
  filtroOsStatus: string;
};

type GateCockpitContextValue = ReturnType<typeof useGateCockpit> & {
  filters: GateCockpitFilters;
  setTurno: (t: GateTurno) => void;
  setBusca: (v: string) => void;
  setDataRef: (v: string) => void;
  setShowNotifs: (v: boolean | ((prev: boolean) => boolean)) => void;
  setFiltroOsStatus: (v: string) => void;
  data: GateCockpitPayload | null;
};

const GateCockpitContext = createContext<GateCockpitContextValue | null>(null);

export function useGateCockpitContext() {
  const ctx = useContext(GateCockpitContext);
  if (!ctx) throw new Error("useGateCockpitContext must be used within GateCockpitProvider");
  return ctx;
}

export function GateCockpitProvider({
  children,
  filters,
  setTurno,
  setBusca,
  setDataRef,
  setShowNotifs,
  setFiltroOsStatus,
}: {
  children: ReactNode;
  filters: GateCockpitFilters;
  setTurno: (t: GateTurno) => void;
  setBusca: (v: string) => void;
  setDataRef: (v: string) => void;
  setShowNotifs: (v: boolean | ((prev: boolean) => boolean)) => void;
  setFiltroOsStatus: (v: string) => void;
}) {
  const cockpit = useGateCockpit(filters.dataRef);

  return (
    <GateCockpitContext.Provider
      value={{
        ...cockpit,
        filters,
        setTurno,
        setBusca,
        setDataRef,
        setShowNotifs,
        setFiltroOsStatus,
      }}
    >
      {children}
    </GateCockpitContext.Provider>
  );
}
