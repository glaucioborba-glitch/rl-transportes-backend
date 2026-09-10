import { staffJson } from "@/lib/api/staff-client";

export const SAAS_PLANOS = ["STANDARD", "PREMIUM", "ENTERPRISE"] as const;

export type SaasTenantUso = {
  users: number;
  clientes: number;
  solicitacoes: number;
  faturas: number;
  unidadeProcessos: number;
};

export type SaasTenantRow = {
  id: string;
  slug: string;
  nome: string;
  status: "ATIVO" | "BLOQUEADO" | "SUSPENSO";
  plano: string;
  cnpj?: string;
  createdAt: string;
  updatedAt: string;
  config?: { tenantKey: string; nome: string } | null;
  uso?: SaasTenantUso;
  ehBase?: boolean;
  podeExcluir?: boolean;
  bloqueioExclusao?: string | null;
};

export type SaasEmpresaIdentidade = {
  razaoSocial?: string;
  nomeFantasia?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  email?: string;
  telefone?: string;
};

export type SaasTenantWrite = {
  slug?: string;
  nome?: string;
  plano?: string;
  status?: SaasTenantRow["status"];
  cnpj?: string;
  empresa?: SaasEmpresaIdentidade;
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
  cnpj?: string;
  empresa?: SaasEmpresaIdentidade;
}): Promise<SaasTenantRow> {
  return staffJson<SaasTenantRow>("/super-admin/tenants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function patchSaasTenant(id: string, payload: SaasTenantWrite): Promise<SaasTenantRow> {
  return staffJson<SaasTenantRow>(`/super-admin/tenants/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteSaasTenant(id: string): Promise<{ ok: boolean; id: string }> {
  return staffJson<{ ok: boolean; id: string }>(`/super-admin/tenants/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function listFeatureFlags(): Promise<FeatureFlagRow[]> {
  return staffJson<FeatureFlagRow[]>("/super-admin/feature-flags");
}

export async function ensureKnownFeatureFlags(): Promise<FeatureFlagRow[]> {
  return staffJson<FeatureFlagRow[]>("/super-admin/feature-flags/ensure-known", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
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
