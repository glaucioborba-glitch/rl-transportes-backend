import { getApiBase } from "@/lib/api/corporate-auth-client";
import { staffJson } from "@/lib/api/staff-client";

export type TenantTurnoConfig = {
  id: string;
  nome: string;
  inicio: string;
  fim: string;
};

export type ReguaCobrancaConfig = {
  ativo?: boolean;
  diasPreVencimento?: number;
  diasAtrasoLeve?: number;
  diasPreBloqueio?: number;
  etapas?: {
    preVencimento?: boolean;
    vencimentoHoje?: boolean;
    atrasoLeve?: boolean;
    preBloqueio?: boolean;
  };
};

export type ReguaCobrancaResponse = {
  tenantId: string;
  reguaCobranca: ReguaCobrancaConfig;
};

export type TenantParametrosResponse = {
  tenantId: string;
  nome: string;
  parametros: {
    branding?: { corPrimaria?: string; logoUrl?: string };
    operacao?: {
      turnos?: TenantTurnoConfig[];
      exigeInspecaoGateIn?: boolean;
      diasFreeTimePadrao?: number;
    };
    reguaCobranca?: ReguaCobrancaConfig;
  };
};

const FALLBACK_TURNOS: TenantTurnoConfig[] = [
  { id: "MANHA", nome: "Manhã", inicio: "06:00", fim: "14:00" },
  { id: "TARDE", nome: "Tarde", inicio: "14:00", fim: "22:00" },
];

export async function fetchTenantTurnos(tenantId = "default"): Promise<TenantTurnoConfig[]> {
  try {
    const res = await fetch(`${getApiBase()}/tenant-config/turnos/${encodeURIComponent(tenantId)}`, {
      cache: "no-store",
    });
    if (!res.ok) return FALLBACK_TURNOS;
    const data = (await res.json()) as TenantTurnoConfig[];
    return data?.length ? data : FALLBACK_TURNOS;
  } catch {
    return FALLBACK_TURNOS;
  }
}

export async function fetchTenantConfigMe(cookieMode = true): Promise<TenantParametrosResponse | null> {
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (cookieMode) headers["X-RL-Auth-Cookie"] = "1";
    const res = await fetch(`${getApiBase()}/tenant-config/me`, {
      credentials: "include",
      headers,
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as TenantParametrosResponse;
  } catch {
    return null;
  }
}

export async function fetchReguaCobranca(): Promise<ReguaCobrancaResponse | null> {
  try {
    return await staffJson<ReguaCobrancaResponse>("/tenant-config/regua-cobranca");
  } catch {
    return null;
  }
}

export async function patchReguaCobranca(body: ReguaCobrancaConfig): Promise<ReguaCobrancaResponse> {
  return staffJson<ReguaCobrancaResponse>("/tenant-config/regua-cobranca", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export { FALLBACK_TURNOS };
