"use client";

import { usePathname } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useGateFilteredData } from "@/hooks/use-gate-filtered-data";
import { useGateCockpitContext } from "./gate-cockpit-context";
import { GateAutorizacaoDetalhePanel, parseAutorizacaoDetalheId } from "./gate-autorizacao-detalhe-panel";
import { GateAutorizacoesPanel } from "./gate-autorizacoes-panel";
import { GateDashboardPanel } from "./gate-dashboard-panel";
import { GateDespachoPanel } from "./gate-despacho-panel";
import { GateFilaChegadaPanel } from "./gate-fila-chegada-panel";
import { GateOperacaoAtivaPanel } from "./gate-operacao-ativa-panel";
import { GateOsPanel } from "./gate-os-panel";
import { GatePatioPanel } from "./gate-patio-panel";
import { gateRefreshSubtitle } from "@/lib/dev-performance";

type Section = {
  title: string;
  subtitle: string;
};

const SECTIONS: Record<string, Section> = {
  dashboard: {
    title: "Dashboard",
    subtitle: gateRefreshSubtitle(),
  },
  autorizacoes: {
    title: "Autorizações Pendentes",
    subtitle: "Revisão completa de solicitações aguardando aprovação",
  },
  fila: {
    title: "Fila de Chegada",
    subtitle: "Caminhões aguardando direcionamento no gate",
  },
  operacao: {
    title: "Operação Ativa",
    subtitle: "Movimentações em andamento no terminal — atualização em tempo real",
  },
  patio: {
    title: "Pátio",
    subtitle: "Ocupação e unidades no pátio",
  },
  despacho: {
    title: "Despacho",
    subtitle: "Caminhões prontos para saída",
  },
  os: {
    title: "Ordens de Serviço",
    subtitle: "OS de movimentação no gate",
  },
};

function resolveSection(pathname: string): string {
  if (pathname.endsWith("/dashboard") || pathname === "/operador/gate") return "dashboard";
  if (pathname.endsWith("/autorizacoes")) return "autorizacoes";
  if (pathname.endsWith("/fila")) return "fila";
  if (pathname.endsWith("/operacao")) return "operacao";
  if (pathname.endsWith("/patio")) return "patio";
  if (pathname.endsWith("/despacho")) return "despacho";
  if (pathname.endsWith("/os")) return "os";
  return "dashboard";
}

export function GateCockpitMain() {
  const pathname = usePathname();
  const detalheId = parseAutorizacaoDetalheId(pathname);
  const { data, loading, refresh, fila, operacao, despacho, patioUnidades, ordens } =
    useGateFilteredData();
  const { filters, setFiltroOsStatus } = useGateCockpitContext();

  if (detalheId) {
    return <GateAutorizacaoDetalhePanel id={detalheId} />;
  }

  const section = resolveSection(pathname);
  const meta = SECTIONS[section] ?? SECTIONS.dashboard;

  return (
    <>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-white">{meta.title}</h1>
        <p className="text-xs text-zinc-500">{meta.subtitle}</p>
      </div>

      {loading && !data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          {section === "dashboard" ? <GateDashboardPanel /> : null}
          {section === "autorizacoes" ? <GateAutorizacoesPanel /> : null}
          {section === "fila" ? (
            <GateFilaChegadaPanel items={fila} onAction={() => void refresh(true)} />
          ) : null}
          {section === "operacao" ? (
            <GateOperacaoAtivaPanel fila={fila} operacao={operacao} despacho={despacho} />
          ) : null}
          {section === "patio" ? (
            <GatePatioPanel
              ocupados={data?.patio.ocupados ?? 0}
              capacidade={data?.patio.capacidade ?? 0}
              reefers={data?.patio.reefersLigados ?? 0}
              unidades={patioUnidades}
            />
          ) : null}
          {section === "despacho" ? <GateDespachoPanel items={despacho} /> : null}
          {section === "os" ? (
            <GateOsPanel
              items={ordens}
              filtroStatus={filters.filtroOsStatus}
              onFiltroStatus={setFiltroOsStatus}
            />
          ) : null}
        </>
      )}
    </>
  );
}
