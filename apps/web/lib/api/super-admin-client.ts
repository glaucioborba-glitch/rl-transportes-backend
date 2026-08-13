import { staffJson } from "@/lib/api/staff-client";

export type SaasTenantRow = {
  id: string;
  slug: string;
  nome: string;
  status: "ATIVO" | "BLOQUEADO" | "SUSPENSO";
  plano: string;
  createdAt: string;
  updatedAt: string;
  config?: { tenantKey: string; nome: string } | null;
};

export type FeatureFlagRow = {
  chave: string;
  ativo: boolean;
  regras: Record<string, unknown> | null;
  descricao?: string | null;
};

export async function listSaasTenants(): Promise<SaasTenantRow[]> {
  return staffJson<SaasTenantRow[]>("/super-admin/tenants");
}

export async function createSaasTenant(payload: {
  slug: string;
  nome: string;
  plano?: string;
}): Promise<SaasTenantRow> {
  return staffJson<SaasTenantRow>("/super-admin/tenants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function patchSaasTenant(
  id: string,
  payload: { status?: SaasTenantRow["status"]; plano?: string; nome?: string },
): Promise<SaasTenantRow> {
  return staffJson<SaasTenantRow>(`/super-admin/tenants/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function listFeatureFlags(): Promise<FeatureFlagRow[]> {
  return staffJson<FeatureFlagRow[]>("/super-admin/feature-flags");
}

export async function patchFeatureFlag(
  chave: string,
  payload: { ativo?: boolean; regras?: Record<string, unknown> },
): Promise<FeatureFlagRow> {
  return staffJson<FeatureFlagRow>(`/super-admin/feature-flags/${encodeURIComponent(chave)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
