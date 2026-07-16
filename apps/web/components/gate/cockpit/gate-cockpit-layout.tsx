"use client";

import { useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { GateTurno } from "@/lib/gate/gate-cockpit-types";
import { matchesTurno } from "@/lib/gate/gate-cockpit-utils";
import { GateCockpitProvider } from "./gate-cockpit-context";
import { GateCockpitMain } from "./gate-cockpit-main";
import { GateCockpitTopbar } from "./gate-cockpit-topbar";

const GATE_STANDALONE_ROUTES = ["/operador/gate/historico-container"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function GateCockpitLayout({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  const isStandalone = GATE_STANDALONE_ROUTES.some((route) => pathname.startsWith(route));

  if (isStandalone) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
      </div>
    );
  }

  return <GateCockpitCockpitShell />;
}

function GateCockpitCockpitShell() {
  const [turno, setTurno] = useState<GateTurno>("TODOS");
  const [busca, setBusca] = useState("");
  const [dataRef, setDataRef] = useState(todayIso());
  const [showNotifs, setShowNotifs] = useState(false);
  const [filtroOsStatus, setFiltroOsStatus] = useState("TODOS");

  const filters = useMemo(
    () => ({ turno, busca, dataRef, showNotifs, filtroOsStatus }),
    [turno, busca, dataRef, showNotifs, filtroOsStatus],
  );

  return (
    <GateCockpitProvider
      filters={filters}
      setTurno={setTurno}
      setBusca={setBusca}
      setDataRef={setDataRef}
      setShowNotifs={setShowNotifs}
      setFiltroOsStatus={setFiltroOsStatus}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <GateCockpitTopbar />
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <GateCockpitMain />
        </div>
      </div>
    </GateCockpitProvider>
  );
}

export function matchBusca(busca: string, placa?: string | null, containers?: string[]) {
  const q = busca.trim().toLowerCase();
  if (!q) return true;
  if (placa?.toLowerCase().includes(q)) return true;
  return (containers ?? []).some((c) => c.toLowerCase().includes(q));
}

export { matchesTurno };
