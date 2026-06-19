import { formatContainerISO } from "@/utils/containerFormatter";

export type ContainerPrimaryDisplay = {
  primary: string;
  extraCount: number;
  all: string[];
};

export function formatIsoDisplay(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  return formatContainerISO(value) || value.trim();
}

export function buildContainerPrimaryDisplay(isos: string[]): ContainerPrimaryDisplay {
  const all = isos.map((iso) => formatIsoDisplay(iso)).filter((v) => v && v !== "—");
  if (!all.length) return { primary: "—", extraCount: 0, all: [] };
  return {
    primary: all[0],
    extraCount: Math.max(0, all.length - 1),
    all,
  };
}

export function collectSolicitacaoContainerISOs(s: {
  containersSolicitacao?: Array<{ unidade?: string; ordem?: number }>;
  unidades?: Array<{ numeroIso?: string }>;
}): string[] {
  const fromCorp = (s.containersSolicitacao ?? [])
    .slice()
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map((c) => c.unidade ?? "")
    .filter(Boolean);
  if (fromCorp.length) return fromCorp;

  return (s.unidades ?? []).map((u) => u.numeroIso ?? "").filter(Boolean);
}

export function solicitacaoContainerPrimary(
  s: Parameters<typeof collectSolicitacaoContainerISOs>[0],
): ContainerPrimaryDisplay {
  return buildContainerPrimaryDisplay(collectSolicitacaoContainerISOs(s));
}

export function operationTitleFromIsos(isos: string[], verb = "Operação"): string {
  const { primary } = buildContainerPrimaryDisplay(isos);
  if (primary === "—") return verb;
  return `${verb}: ${primary}`;
}

export function extraUnitsBadgeLabel(extraCount: number): string | null {
  if (extraCount <= 0) return null;
  return extraCount === 1 ? "+1 unidade" : `+${extraCount} unidades`;
}
