import { applyCsrfHeaders } from "@/lib/csrf-client";
import { staffJson, staffRequest } from "@/lib/api/staff-client";
import { ApiError } from "@/lib/api/corporate-auth-client";

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
  moedaCorrente?: string;
  idiomaPadrao?: string;
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
  moedaCorrente?: string;
  idiomaPadrao?: string;
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
  moedaCorrente?: string;
  idiomaPadrao?: string;
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

export type SaasTipoContainer = {
  id: string;
  codigo: string;
  nome: string;
  tamanhos: string[];
  tomadaReefer: boolean;
  ativo: boolean;
};

function qsSaas(params: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function listSaasTiposContainer(search?: string) {
  return staffJson<{ items: SaasTipoContainer[]; total: number }>(
    `/super-admin/tipos-container${qsSaas({ search })}`,
  );
}

export async function getSaasTipoContainer(id: string): Promise<SaasTipoContainer> {
  return staffJson<SaasTipoContainer>(`/super-admin/tipos-container/${encodeURIComponent(id)}`);
}

export async function createSaasTipoContainer(
  data: Omit<SaasTipoContainer, "id">,
): Promise<SaasTipoContainer> {
  return staffJson<SaasTipoContainer>("/super-admin/tipos-container", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateSaasTipoContainer(
  id: string,
  data: Omit<SaasTipoContainer, "id">,
): Promise<SaasTipoContainer> {
  return staffJson<SaasTipoContainer>(`/super-admin/tipos-container/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function listSaasCatalogoContainers(q?: string) {
  const query = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return staffJson<{
    items: import("@/lib/catalogo-container-iso").CatalogoContainerIso[];
    total: number;
  }>(`/super-admin/catalogo-containers${query}`);
}

export type CatalogoContainersImportResultado = {
  criados: number;
  atualizados: number;
  duplicadosNaPlanilha: number;
  erros: Array<{ linha: number; iso: string; motivo: string }>;
};

export async function baixarModeloCatalogoContainers(): Promise<void> {
  const res = await staffRequest("/super-admin/catalogo-containers/modelo", {
    method: "GET",
    headers: { Accept: "application/vnd.ms-excel" },
  });
  if (!res.ok) {
    throw new ApiError("Não foi possível baixar o modelo.", res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "catalogo-containers-modelo.xls";
  a.click();
  URL.revokeObjectURL(url);
}

export async function importarCatalogoContainers(file: File): Promise<CatalogoContainersImportResultado> {
  const form = new FormData();
  form.append("file", file);
  return staffJson<CatalogoContainersImportResultado>("/super-admin/catalogo-containers/importar", {
    method: "POST",
    body: form,
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

export type SaIntranetSessao = {
  acting: boolean;
  tenantId: string | null;
  nome: string | null;
  slug: string | null;
  status: SaasTenantRow["status"] | null;
};

export type SaEntrarIntranetResult = {
  ok: true;
  tenantId: string;
  nome: string;
  slug: string;
  status: SaasTenantRow["status"];
};

async function parseProxyJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    throw new ApiError(text || `Erro HTTP ${res.status}`, res.status);
  }
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

/** Mesma origem (:3000) para o cookie HttpOnly chegar no middleware. */
export async function entrarIntranetTenant(tenantId: string): Promise<SaEntrarIntranetResult> {
  const headers = new Headers({ "Content-Type": "application/json" });
  applyCsrfHeaders(headers, "POST");
  const res = await fetch("/api/super-admin/entrar-intranet", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ tenantId }),
  });
  return parseProxyJson<SaEntrarIntranetResult>(res);
}

export async function sairIntranetTenant(): Promise<{ ok: boolean }> {
  const headers = new Headers({ "Content-Type": "application/json" });
  applyCsrfHeaders(headers, "POST");
  const res = await fetch("/api/super-admin/sair-intranet", {
    method: "POST",
    credentials: "include",
    headers,
    body: "{}",
  });
  return parseProxyJson<{ ok: boolean }>(res);
}

export async function getIntranetSessao(): Promise<SaIntranetSessao> {
  return staffJson<SaIntranetSessao>("/super-admin/intranet-sessao");
}

export type SaasIntegracaoOrigem = "env" | "tenant" | "none";

export type SaasIntegracaoStatus = {
  enabled: boolean;
  configured: boolean;
  origem: SaasIntegracaoOrigem;
  lockedByEnv: boolean;
  phoneNumberId?: string;
  templatesAprovados?: number;
  apiKeyPresent?: boolean;
  clientEmail?: string;
  provider?: string;
  bucket?: string;
  endpoint?: string;
  region?: string;
  accessTokenPresent?: boolean;
  businessAccountIdPresent?: boolean;
  apiBaseUrl?: string;
  terminalLat?: string;
  terminalLng?: string;
  chavePixPresent?: boolean;
  chavePixHint?: string;
};

export type SaasIntegracoes = {
  whatsapp: SaasIntegracaoStatus & {
    phoneNumberId?: string;
    templatesAprovados: number;
    accessTokenPresent: boolean;
    businessAccountIdPresent: boolean;
  };
  googleVision: SaasIntegracaoStatus & { apiKeyPresent: boolean; clientEmail?: string };
  googleMaps: SaasIntegracaoStatus & { apiKeyPresent: boolean };
  googleRoutes: SaasIntegracaoStatus & { apiKeyPresent: boolean };
  banking: SaasIntegracaoStatus & { apiBaseUrl?: string };
  boleto: SaasIntegracaoStatus & { apiBaseUrl?: string };
  pix: SaasIntegracaoStatus & {
    apiBaseUrl?: string;
    chavePixPresent: boolean;
    chavePixHint?: string;
    apiTokenPresent: boolean;
  };
  s3: SaasIntegracaoStatus & { bucket?: string; endpoint?: string; region?: string };
};

export type SaasIntegracoesPatch = {
  googleVision?: { apiKey?: string; credentialsJson?: string };
  googleMaps?: { apiKey?: string };
  googleRoutes?: { apiKey?: string };
  whatsapp?: {
    enabled?: boolean;
    phoneNumberId?: string;
    accessToken?: string;
    businessAccountId?: string;
  };
  banking?: { apiBaseUrl?: string; apiToken?: string };
  boleto?: { apiBaseUrl?: string; apiToken?: string };
  pix?: { apiBaseUrl?: string; apiToken?: string; chavePix?: string };
  s3?: {
    bucket?: string;
    endpoint?: string;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    publicBaseUrl?: string;
  };
};

export type SaasIntegrationId =
  | "whatsapp"
  | "google-vision"
  | "google-maps"
  | "google-routes"
  | "banking"
  | "boleto"
  | "pix"
  | "s3";

export async function fetchSaasIntegracoes(tenantId: string) {
  return staffJson<{ tenantId: string; integracoes: SaasIntegracoes }>(
    `/super-admin/tenants/${encodeURIComponent(tenantId)}/integracoes`,
  );
}

export async function patchSaasIntegracoes(tenantId: string, patch: SaasIntegracoesPatch) {
  return staffJson<{ tenantId: string; integracoes: SaasIntegracoes }>(
    `/super-admin/tenants/${encodeURIComponent(tenantId)}/integracoes`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
}

export async function testSaasIntegracao(tenantId: string, id: SaasIntegrationId) {
  return staffJson<{ connected: boolean; message: string; latency?: number }>(
    `/super-admin/tenants/${encodeURIComponent(tenantId)}/integracoes/test/${id}`,
  );
}
