import { applyCsrfHeaders } from "@/lib/csrf-client";
import {
  applyPortalLoginResponse,
  ensurePortalPessoaSession,
  inferPortalClienteTipo,
} from "@/lib/portal-pessoa-session";
import { usePortalClienteAuthStore } from "@/stores/portalClienteAuthStore";
import { ApiError, getApiBase } from "@/lib/api/corporate-auth-client";
import { getDeviceSecurityHeaders, appendDeviceSecurityHeaders } from "@/lib/device-client-headers";
import { maybeUnwrapCircuitJson } from "@/lib/resilience/circuit-open";
import type { ContainerTimelineResponse } from "@/lib/container-timeline";
import { stripContainerISO } from "@/utils/containerFormatter";
import { hasPortalClientSession, isPortalCookieAuthMode } from "@/lib/portal-auth-mode";
import type {
  KpisResponse,
  PaginatedResponse,
  PortalLoginResponse,
  SlasResponse,
} from "@/lib/api/types";

export { ApiError, getApiBase, defaultApiCredentials } from "@/lib/api/corporate-auth-client";

const LOGIN_TIMEOUT_MS = 25_000;
const PORTAL_COOKIE_HEADERS: Record<string, string> = { "X-RL-Portal-Cookie": "1" };

function portalApiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (isPortalCookieAuthMode() && typeof window !== "undefined") {
    return `/api/portal/proxy${p}`;
  }
  return `${getApiBase()}${p}`;
}

/** Restaura sessão portal a partir de cookies HttpOnly (sobrevive F5). */
export async function portalHydrateSessionFromCookies(): Promise<boolean> {
  if (!isPortalCookieAuthMode()) return false;
  try {
    const res = await fetch("/api/portal/me", {
      credentials: "include",
      headers: { Accept: "application/json", ...PORTAL_COOKIE_HEADERS },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as PortalLoginResponse;
    if (!data?.portalIdentity) return false;
    applyPortalLoginResponse({
      accessToken: "",
      refreshToken: "",
      tokenType: "Bearer",
      portalIdentity: data.portalIdentity,
      clienteId: data.clienteId ?? null,
      portalPapel: data.portalPapel,
      tenantId: data.tenantId,
      tipo: data.tipo,
      cliente: data.cliente,
      usuario: data.usuario,
    });
    return true;
  } catch {
    return false;
  }
}

export async function portalLogoutCookies(): Promise<void> {
  if (!isPortalCookieAuthMode()) return;
  try {
    await fetch("/api/portal/logout", {
      method: "POST",
      credentials: "include",
      headers: PORTAL_COOKIE_HEADERS,
    });
  } catch {
    /* ignore */
  }
}

/** Marca product tour concluído (fire-and-forget; atualiza store local). */
export function markPortalOnboardingConcluido(): void {
  const st = usePortalClienteAuthStore.getState();
  if (st.user) {
    st.setUser({ ...st.user, onboardingConcluido: true });
  }

  const headers = new Headers({
    Accept: "application/json",
    ...PORTAL_COOKIE_HEADERS,
  });
  applyCsrfHeaders(headers, "POST");

  const url =
    isPortalCookieAuthMode() && typeof window !== "undefined"
      ? "/api/usuario/onboarding-concluido"
      : `${getApiBase()}/portal/usuario/onboarding-concluido`;

  const init: RequestInit = {
    method: "POST",
    credentials: "include",
    headers,
  };
  if (!isPortalCookieAuthMode() && st.accessToken) {
    headers.set("Authorization", `Bearer ${st.accessToken}`);
  }

  void fetch(url, init).catch(() => {
    /* não bloqueia UX */
  });
}

/** GET `/health` — sem autenticação; usado pelo modo degradado do portal. */
export type PortalHealthResponse = {
  api: string;
  database: string;
  redis: string;
  securityEngine: "ok" | "degraded" | "offline";
  timestamp: string;
};

const HEALTH_POLL_OK_MS = 60_000;
const HEALTH_POLL_ERR_MS = 120_000;

const portalHealthListeners = new Set<(h: PortalHealthResponse | null) => void>();
let portalHealthTimer: ReturnType<typeof setTimeout> | null = null;
let portalHealthPollStarted = false;
let portalHealthLast: PortalHealthResponse | null = null;

export async function fetchHealth(): Promise<PortalHealthResponse | null> {
  try {
    const res = await fetch(`${getApiBase()}/health`, {
      method: "GET",
      credentials: "omit",
    });
    if (!res.ok) return null;
    return (await res.json()) as PortalHealthResponse;
  } catch {
    return null;
  }
}

export function getPortalHealthSnapshot(): PortalHealthResponse | null {
  return portalHealthLast;
}

function schedulePortalHealthPoll(delayMs: number): void {
  if (portalHealthTimer) clearTimeout(portalHealthTimer);
  portalHealthTimer = setTimeout(() => void portalHealthPollTick(), delayMs);
}

async function portalHealthPollTick(): Promise<void> {
  const h = await fetchHealth();
  portalHealthLast = h;
  portalHealthListeners.forEach((fn) => {
    fn(h);
  });
  schedulePortalHealthPoll(h ? HEALTH_POLL_OK_MS : HEALTH_POLL_ERR_MS);
}

/** Inicia polling periódico (60s OK / 120s erro); idempotente. */
export function ensurePortalHealthPolling(): void {
  if (portalHealthPollStarted) return;
  portalHealthPollStarted = true;
  schedulePortalHealthPoll(0);
}

export function subscribePortalHealth(cb: (h: PortalHealthResponse | null) => void): () => void {
  portalHealthListeners.add(cb);
  cb(portalHealthLast);
  ensurePortalHealthPolling();
  return () => {
    portalHealthListeners.delete(cb);
  };
}

function parsePortalHttpError(text: string, status: number): string {
  const t = text?.trim();
  if (!t) return `Erro HTTP ${status}`;
  try {
    const j = JSON.parse(t) as { message?: string | string[]; error?: string };
    const m = j.message;
    if (typeof m === "string" && m.trim()) return m;
    if (Array.isArray(m) && m.length) return m.map(String).join(", ");
    if (typeof j.error === "string" && j.error.trim()) return j.error;
  } catch {
    /* corpo não-JSON */
  }
  return t.length > 280 ? `${t.slice(0, 280)}…` : t;
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    return maybeUnwrapCircuitJson<T>(raw);
  } catch {
    throw new ApiError("Resposta inválida da API", res.status);
  }
}

export {
  mapPortalLoginToUser,
  mergePortalUserAfterRefresh,
  applyPortalLoginResponse,
  inferPortalClienteTipo,
  type EnsurePortalPessoaResult,
} from "@/lib/portal-pessoa-session";

/** CLIENTE: exclusivamente `POST /portal/login` (Bearer ou cookies HttpOnly via BFF). */
export async function portalClienteLogin(documento: string, password: string): Promise<PortalLoginResponse> {
  const cookieMode = isPortalCookieAuthMode();
  const apiBase = getApiBase();
  const url = cookieMode && typeof window !== "undefined" ? "/api/portal/login" : `${apiBase}/portal/login`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);
  let res: Response;
  try {
    const devHeaders = typeof window !== "undefined" ? await getDeviceSecurityHeaders() : {};
    res = await fetch(url, {
      method: "POST",
      headers: {
        ...devHeaders,
        ...PORTAL_COOKIE_HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        documento: documento.replace(/\D/g, ""),
        password,
        papel: "CLIENTE",
        tenantId: "default",
      }),
      credentials: "include",
      signal: controller.signal,
    });
  } catch (e: unknown) {
    const aborted =
      (e instanceof DOMException && e.name === "AbortError") ||
      (e instanceof Error && e.name === "AbortError");
    if (aborted) {
      throw new ApiError(`Tempo esgotado ao contatar a API (${apiBase}).`, 0);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) {
    const raw = await res.text();
    let msg = raw?.trim() || `Falha no login portal (${res.status})`;
    try {
      const j = JSON.parse(raw) as { message?: string | string[] };
      if (Array.isArray(j.message)) msg = j.message.join(", ");
      else if (typeof j.message === "string" && j.message.trim()) msg = j.message.trim();
    } catch {
      /* */
    }
    throw new ApiError(msg, res.status);
  }
  const data = await parseJson<PortalLoginResponse>(res);
  if (cookieMode) {
    if (!data?.portalIdentity) throw new ApiError("Resposta /portal/login incompleta.", res.status);
    return {
      ...data,
      accessToken: "",
      refreshToken: "",
      tokenType: "Bearer",
    } as PortalLoginResponse;
  }
  if (!data?.accessToken?.trim() || !data?.refreshToken?.trim() || !data?.portalIdentity) {
    throw new ApiError("Resposta /portal/login incompleta.", res.status);
  }
  return data;
}

export async function portalClienteRefresh(refreshToken: string): Promise<PortalLoginResponse> {
  const cookieMode = isPortalCookieAuthMode();
  const devHeaders = typeof window !== "undefined" ? await getDeviceSecurityHeaders() : {};
  const url =
    cookieMode && typeof window !== "undefined" ? "/api/portal/refresh" : `${getApiBase()}/portal/refresh`;
  const res = await fetch(url, {
    method: "POST",
    headers: { ...devHeaders, ...PORTAL_COOKIE_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(cookieMode && !refreshToken?.trim() ? {} : { refreshToken }),
    credentials: "include",
  });
  if (!res.ok) throw new ApiError("Sessão portal expirada", res.status);
  if (cookieMode) {
    await parseJson<{ ok?: boolean }>(res);
    const hydrated = await portalHydrateSessionFromCookies();
    if (!hydrated) throw new ApiError("Sessão portal expirada", 401);
    const st = usePortalClienteAuthStore.getState();
    return {
      accessToken: st.accessToken ?? "",
      refreshToken: st.refreshToken ?? "",
      tokenType: "Bearer",
      portalIdentity: {
        sub: st.user!.id,
        email: st.user!.email,
        cpfCnpj: st.user!.cpfCnpj,
        portalPapel: "CLIENTE",
        tenantId: "default",
      },
      clienteId: st.user?.clienteId ?? null,
      portalPapel: "CLIENTE",
      tenantId: "default",
    };
  }
  return parseJson(res);
}

/** Requisições autenticadas portal CX (Bearer em memória ou cookies HttpOnly via proxy BFF). */
export async function portalRequest(path: string, init?: RequestInit): Promise<Response> {
  const url = portalApiUrl(path);
  const cookieMode = isPortalCookieAuthMode();

  const st0 = usePortalClienteAuthStore.getState();
  let accessToken = st0.accessToken?.trim() ? st0.accessToken : null;
  const initialRefresh = st0.refreshToken;

  if (!accessToken && cookieMode) {
    if (!st0.sessionHydrated) {
      await portalHydrateSessionFromCookies();
    }
    accessToken = cookieMode ? "cookie" : null;
  }

  if (!accessToken && !cookieMode) {
    if (!initialRefresh?.trim()) {
      throw new ApiError("Sessão não iniciada", 401);
    }
    try {
      const next = await portalClienteRefresh(initialRefresh);
      applyPortalLoginResponse(next);
      accessToken = next.accessToken.trim() ? next.accessToken : null;
    } catch {
      st0.clear();
      throw new ApiError("Sessão expirada", 401);
    }
    if (!accessToken) {
      st0.clear();
      throw new ApiError("Sessão não iniciada", 401);
    }
  }

  const doFetch = async (token: string | null) => {
    const headers = new Headers(init?.headers);
    if (!headers.has("Content-Type") && init?.body && !(init.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    if (token && token !== "cookie") headers.set("Authorization", `Bearer ${token}`);
    if (cookieMode) {
      for (const [k, v] of Object.entries(PORTAL_COOKIE_HEADERS)) headers.set(k, v);
    }
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    applyCsrfHeaders(headers, init?.method);
    await appendDeviceSecurityHeaders(headers);
    return fetch(url, { ...init, headers, credentials: init?.credentials ?? "include" });
  };

  let res = await doFetch(accessToken);

  if (res.status === 401) {
    const st = usePortalClienteAuthStore.getState();
    const rt = st.refreshToken;
    if (cookieMode || rt?.trim()) {
      try {
        const next = await portalClienteRefresh(rt ?? "");
        if (!cookieMode) applyPortalLoginResponse(next);
        const tok = cookieMode ? "cookie" : next.accessToken.trim();
        if (!tok) {
          st.clear();
          throw new ApiError("Sessão expirada", 401);
        }
        res = await doFetch(tok);
      } catch (e) {
        usePortalClienteAuthStore.getState().clear();
        throw e instanceof ApiError ? e : new ApiError("Sessão expirada", 401);
      }
    } else {
      st.clear();
      throw new ApiError("Sessão expirada", 401);
    }
  }

  return res;
}

/** GET autenticado sem `Content-Type: application/json` (PDF, CSV, etc.). */
export async function portalMediaRequest(path: string, init?: RequestInit): Promise<Response> {
  const url = portalApiUrl(path);
  const cookieMode = isPortalCookieAuthMode();
  const method = (init?.method ?? "GET").toUpperCase();

  const st0 = usePortalClienteAuthStore.getState();
  let accessToken = st0.accessToken?.trim() ? st0.accessToken : null;
  const initialRefresh = st0.refreshToken;

  if (!accessToken && cookieMode) {
    if (!st0.sessionHydrated) await portalHydrateSessionFromCookies();
    accessToken = "cookie";
  }

  if (!accessToken && !cookieMode) {
    if (!initialRefresh?.trim()) {
      throw new ApiError("Sessão não iniciada", 401);
    }
    try {
      const next = await portalClienteRefresh(initialRefresh);
      applyPortalLoginResponse(next);
      accessToken = next.accessToken.trim() ? next.accessToken : null;
    } catch {
      st0.clear();
      throw new ApiError("Sessão expirada", 401);
    }
    if (!accessToken) {
      st0.clear();
      throw new ApiError("Sessão não iniciada", 401);
    }
  }

  const doFetch = async (token: string) => {
    const headers = new Headers(init?.headers);
    if (token !== "cookie") headers.set("Authorization", `Bearer ${token}`);
    if (cookieMode) {
      for (const [k, v] of Object.entries(PORTAL_COOKIE_HEADERS)) headers.set(k, v);
    }
    if (!headers.has("Accept")) headers.set("Accept", "*/*");
    applyCsrfHeaders(headers, method);
    await appendDeviceSecurityHeaders(headers);
    return fetch(url, { ...init, method, headers, credentials: init?.credentials ?? "include" });
  };

  let res = await doFetch(accessToken!);

  if (res.status === 401) {
    const st = usePortalClienteAuthStore.getState();
    const rt = st.refreshToken;
    if (cookieMode || rt?.trim()) {
      try {
        const next = await portalClienteRefresh(rt ?? "");
        if (!cookieMode) applyPortalLoginResponse(next);
        const tok = cookieMode ? "cookie" : next.accessToken.trim();
        if (!tok) {
          st.clear();
          throw new ApiError("Sessão expirada", 401);
        }
        res = await doFetch(tok);
      } catch (e) {
        usePortalClienteAuthStore.getState().clear();
        throw e instanceof ApiError ? e : new ApiError("Sessão expirada", 401);
      }
    } else {
      st.clear();
      throw new ApiError("Sessão expirada", 401);
    }
  }

  return res;
}

/** PDF operacional v2 (Bearer portal + fingerprint). */
export async function portalDownloadSolicitacaoV2Pdf(solicitacaoId: string): Promise<Blob> {
  const res = await portalMediaRequest(`/v2/solicitacoes/${encodeURIComponent(solicitacaoId)}/pdf`, {
    method: "GET",
    headers: { Accept: "application/pdf" },
  });
  if (res.status === 401) {
    usePortalClienteAuthStore.getState().clear();
    throw new ApiError("Não autorizado", 401);
  }
  if (!res.ok) {
    const err = await res.text();
    throw new ApiError(err || `Erro HTTP ${res.status}`, res.status);
  }
  return res.blob();
}

/** Upload autenticado (FormData) sem forçar `Content-Type` (boundary do multipart). */
export async function portalMultipartRequest(
  path: string,
  form: FormData,
  method: "POST" | "PUT" | "PATCH" = "POST",
): Promise<Response> {
  const url = portalApiUrl(path);
  const cookieMode = isPortalCookieAuthMode();

  const st0 = usePortalClienteAuthStore.getState();
  let accessToken = st0.accessToken?.trim() ? st0.accessToken : null;
  const initialRefresh = st0.refreshToken;

  if (!accessToken && cookieMode) {
    if (!st0.sessionHydrated) await portalHydrateSessionFromCookies();
    accessToken = "cookie";
  }

  if (!accessToken && !cookieMode) {
    if (!initialRefresh?.trim()) {
      throw new ApiError("Sessão não iniciada", 401);
    }
    try {
      const next = await portalClienteRefresh(initialRefresh);
      applyPortalLoginResponse(next);
      accessToken = next.accessToken.trim() ? next.accessToken : null;
    } catch {
      st0.clear();
      throw new ApiError("Sessão expirada", 401);
    }
    if (!accessToken) {
      st0.clear();
      throw new ApiError("Sessão não iniciada", 401);
    }
  }

  const doFetch = async (token: string | null) => {
    const headers = new Headers();
    if (token && token !== "cookie") headers.set("Authorization", `Bearer ${token}`);
    if (cookieMode) {
      for (const [k, v] of Object.entries(PORTAL_COOKIE_HEADERS)) headers.set(k, v);
    }
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    applyCsrfHeaders(headers, method);
    await appendDeviceSecurityHeaders(headers);
    return fetch(url, { method, body: form, headers, credentials: "include" });
  };

  let res = await doFetch(accessToken);

  if (res.status === 401) {
    const st = usePortalClienteAuthStore.getState();
    const rt = st.refreshToken;
    if (cookieMode || rt?.trim()) {
      try {
        const next = await portalClienteRefresh(rt ?? "");
        if (!cookieMode) applyPortalLoginResponse(next);
        const tok = cookieMode ? "cookie" : next.accessToken.trim();
        if (!tok) {
          st.clear();
          throw new ApiError("Sessão expirada", 401);
        }
        res = await doFetch(tok);
      } catch (e) {
        usePortalClienteAuthStore.getState().clear();
        throw e instanceof ApiError ? e : new ApiError("Sessão expirada", 401);
      }
    } else {
      st.clear();
      throw new ApiError("Sessão expirada", 401);
    }
  }

  return res;
}

export async function portalMultipartJson<T>(
  path: string,
  form: FormData,
  method: "POST" | "PUT" | "PATCH" = "POST",
): Promise<T> {
  const res = await portalMultipartRequest(path, form, method);
  if (res.status === 401) {
    usePortalClienteAuthStore.getState().clear();
    throw new ApiError("Não autorizado", 401);
  }
  if (!res.ok) {
    const err = await res.text();
    throw new ApiError(err || `Erro HTTP ${res.status}`, res.status);
  }
  return parseJson<T>(res);
}

export async function portalJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await portalRequest(path, init);
  if (res.status === 401) {
    usePortalClienteAuthStore.getState().clear();
    const { usePessoaAutorizadaStore } = await import("@/stores/pessoaAutorizadaStore");
    const { usePessoaPermissoesStore } = await import("@/stores/pessoaPermissoesStore");
    usePessoaAutorizadaStore.getState().clear();
    usePessoaPermissoesStore.getState().clear();
    clearPortalMinhasPermissoesCache();
    throw new ApiError("Não autorizado", 401);
  }
  if (!res.ok) {
    const err = await res.text();
    throw new ApiError(parsePortalHttpError(err, res.status), res.status);
  }
  return parseJson<T>(res);
}

const DEFAULT_PORTAL_KPIS: KpisResponse = {
  personalizaveis: ["ciclo_medio_horas", "containers_ativos", "faturamento_aberto"],
  valores: {
    ciclo_medio_horas: null,
    containers_ativos: 0,
    faturamento_aberto: 0,
  },
};

const DEFAULT_PORTAL_SLAS: SlasResponse = {
  tenantId: "default",
  contratadosProxy: {},
  historicoProxy: [{ periodo: "30d", cumprimentoPctProxy: 100 }],
};

/** Garante campos obrigatórios após fallback de resiliência ou cache legado. */
export function normalizePortalDashboard(
  dash: PortalDashboardConsolidatedResponse,
): PortalDashboardConsolidatedResponse {
  return {
    ...dash,
    financeiro: dash.financeiro ?? {
      boletosPendentes: 0,
      nfseEmitidas: 0,
      faturadoMes: 0,
      totalFaturadoPeriodo: 0,
    },
    slas: dash.slas ?? { cumpridos: 0, violados: 0, desempenho: 100 },
    kpisCx: dash.kpisCx ?? DEFAULT_PORTAL_KPIS,
    slasCx: dash.slasCx ?? DEFAULT_PORTAL_SLAS,
    unidades: dash.unidades ?? {
      total: 0,
      import: 0,
      export: 0,
      gateIn: 0,
      gateOut: 0,
    },
    tendencias: dash.tendencias ?? {
      solicitacoesMesVsAnteriorPct: 0,
      faturadoMesVsAnteriorPct: 0,
    },
    trackingSample: dash.trackingSample ?? [],
    solicitacoesHoje: dash.solicitacoesHoje ?? [],
    recent: dash.recent ?? {
      items: [],
      total: 0,
      page: 1,
      limit: 8,
      orderBy: "createdAt",
      order: "desc",
    },
    isBloqueadoFinanceiramente: Boolean(dash.isBloqueadoFinanceiramente),
  };
}

export type PessoaAutorizadaRow = {
  id: string;
  nome: string;
  email: string;
  cpf?: string | null;
  telefone: string | null;
  ativo?: boolean;
};

/** Confirma identidade operacional por CPF (validação cega pós-login). */
export function portalValidarPessoa(cpf: string) {
  const cpfLimpo = cpf.replace(/\D/g, "");
  return portalJson<PessoaAutorizadaRow>("/portal/auth/validar-pessoa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cpf: cpfLimpo }),
  });
}

export function portalListarPessoasAutorizadasCliente(clienteId: string) {
  return portalJson<PessoaAutorizadaRow[]>(
    `/cliente/pessoas-autorizadas/${encodeURIComponent(clienteId)}`,
  );
}

export function portalCriarPessoaAutorizada(payload: {
  nome: string;
  email: string;
  cpf: string;
  telefone?: string;
  permissoes?: Partial<PermissoesPessoaRow>;
}) {
  return portalJson<PessoaAutorizadaRow>("/cliente/pessoas-autorizadas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      cpf: payload.cpf.replace(/\D/g, ""),
      telefone: payload.telefone?.replace(/\D/g, ""),
    }),
  });
}

export function portalObterPermissoesPessoa(pessoaId: string) {
  return portalJson<PermissoesPessoaRow>(
    `/cliente/pessoas-autorizadas/${encodeURIComponent(pessoaId)}/permissoes`,
  );
}

export function portalPatchPermissoesPessoa(
  pessoaId: string,
  permissoes: Partial<PermissoesPessoaRow>,
) {
  return portalJson<PermissoesPessoaRow>(
    `/cliente/pessoas-autorizadas/${encodeURIComponent(pessoaId)}/permissoes`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(permissoes),
    },
  );
}

export function portalAtualizarPessoaAutorizada(
  pessoaId: string,
  payload: { ativo?: boolean; email?: string; telefone?: string },
) {
  return portalJson<PessoaAutorizadaRow>(
    `/cliente/pessoas-autorizadas/${encodeURIComponent(pessoaId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        telefone: payload.telefone?.replace(/\D/g, ""),
      }),
    },
  );
}

export function portalRevogarPessoaAutorizada(pessoaId: string) {
  return portalAtualizarPessoaAutorizada(pessoaId, { ativo: false });
}

export type TransportadoraAutorizadaRow = {
  id: string;
  cnpj: string;
  razaoSocial: string;
  emailContato: string;
  ativo: boolean;
  createdAt?: string;
};

export function portalListarTransportadorasAutorizadas(clienteId: string) {
  return portalJson<TransportadoraAutorizadaRow[]>(
    `/cliente/transportadoras-autorizadas/${encodeURIComponent(clienteId)}`,
  );
}

export function portalCriarTransportadoraAutorizada(payload: {
  cnpj: string;
  razaoSocial: string;
  emailContato: string;
  password: string;
}) {
  return portalJson<TransportadoraAutorizadaRow>("/cliente/transportadoras-autorizadas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      cnpj: payload.cnpj.replace(/\D/g, ""),
    }),
  });
}

export function portalAlternarTransportadoraAtiva(id: string, ativo: boolean) {
  return portalJson<TransportadoraAutorizadaRow>(
    `/cliente/transportadoras-autorizadas/${encodeURIComponent(id)}/ativo`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo }),
    },
  );
}

export function portalPessoaAtual() {
  return portalJson<PessoaAutorizadaRow | null>("/portal/auth/pessoa-atual");
}

export type PermissoesPessoaRow = {
  podeCriarSolicitacao: boolean;
  podeAnexarDocumentos: boolean;
  podeAgendarTurno: boolean;
  podeVisualizarFinanceiro: boolean;
  podeAprovarOS: boolean;
  podeVerOS: boolean;
  podeAlterarDadosGate: boolean;
  podeGerarPDF: boolean;
  podeGerenciarPessoas: boolean;
};

export type MinhasPermissoesResponse = {
  sucesso: boolean;
  permissoes: PermissoesPessoaRow;
  pessoa: PessoaAutorizadaRow | null;
  precisaSelecionarPessoa?: boolean;
};

export type PortalAuthBootstrapResponse = MinhasPermissoesResponse & {
  precisaSelecionarPessoa: boolean;
};

export type PortalAuthHealthResponse = PortalAuthBootstrapResponse & {
  ok: boolean;
  timestamp: string;
};

const DEFAULT_PERMISSOES_ROW: PermissoesPessoaRow = {
  podeCriarSolicitacao: true,
  podeAnexarDocumentos: true,
  podeAgendarTurno: true,
  podeVisualizarFinanceiro: false,
  podeAprovarOS: false,
  podeVerOS: true,
  podeAlterarDadosGate: false,
  podeGerarPDF: true,
  podeGerenciarPessoas: false,
};

const EMPTY_BOOTSTRAP: PortalAuthBootstrapResponse = {
  sucesso: true,
  permissoes: DEFAULT_PERMISSOES_ROW,
  pessoa: null,
  precisaSelecionarPessoa: true,
};

let authBootstrapCache: PortalAuthBootstrapResponse | undefined;
let authBootstrapInflight: Promise<PortalAuthBootstrapResponse> | null = null;
let minhasPermissoesCache: PermissoesPessoaRow | null | undefined;
let minhasPermissoesInflight: Promise<PermissoesPessoaRow | null> | null = null;

export function clearPortalMinhasPermissoesCache(): void {
  authBootstrapCache = undefined;
  authBootstrapInflight = null;
  minhasPermissoesCache = undefined;
  minhasPermissoesInflight = null;
}

/** Bootstrap de sessão portal — cache + dedupe; nunca entra em loop de retry. */
export async function portalAuthBootstrap(opts?: {
  force?: boolean;
}): Promise<PortalAuthBootstrapResponse> {
  const st = usePortalClienteAuthStore.getState();
  const cookieMode = isPortalCookieAuthMode();
  if (!st.accessToken?.trim() && cookieMode && !st.sessionHydrated) {
    await portalHydrateSessionFromCookies();
  }
  const token = usePortalClienteAuthStore.getState().accessToken;
  const hydrated = usePortalClienteAuthStore.getState().sessionHydrated;
  if (!token?.trim() && !(cookieMode && hydrated && st.user)) return EMPTY_BOOTSTRAP;

  const { usePessoaAutorizadaStore } = await import("@/stores/pessoaAutorizadaStore");
  const { usePessoaPermissoesStore } = await import("@/stores/pessoaPermissoesStore");
  const pessoaLocal = usePessoaAutorizadaStore.getState().pessoa;
  const stored = usePessoaPermissoesStore.getState();

  if (
    !opts?.force &&
    authBootstrapCache &&
    pessoaLocal?.id &&
    authBootstrapCache.pessoa?.id === pessoaLocal.id &&
    !authBootstrapCache.precisaSelecionarPessoa
  ) {
    return authBootstrapCache;
  }

  if (
    !opts?.force &&
    pessoaLocal?.id &&
    stored.permissoes &&
    stored.boundPessoaId === pessoaLocal.id
  ) {
    authBootstrapCache = {
      sucesso: true,
      permissoes: stored.permissoes,
      pessoa: pessoaLocal,
      precisaSelecionarPessoa: false,
    };
    minhasPermissoesCache = stored.permissoes;
    return authBootstrapCache;
  }

  if (!opts?.force && authBootstrapCache) {
    return authBootstrapCache;
  }
  if (authBootstrapInflight) {
    return authBootstrapInflight;
  }

  authBootstrapInflight = (async () => {
    try {
      const body = await portalJson<PortalAuthBootstrapResponse>("/portal/auth/minhas-permissoes");
      const boot: PortalAuthBootstrapResponse = {
        sucesso: body?.sucesso ?? true,
        permissoes: body?.permissoes ?? DEFAULT_PERMISSOES_ROW,
        pessoa: body?.pessoa ?? null,
        precisaSelecionarPessoa: body?.precisaSelecionarPessoa ?? !body?.pessoa,
      };
      authBootstrapCache = boot;
      minhasPermissoesCache = boot.permissoes;
      if (boot.pessoa && !boot.precisaSelecionarPessoa) {
        usePessoaAutorizadaStore.getState().setPessoa({
          id: boot.pessoa.id,
          nome: boot.pessoa.nome,
          email: boot.pessoa.email,
          telefone: boot.pessoa.telefone,
        });
        usePessoaPermissoesStore.getState().setPermissoes(boot.permissoes, boot.pessoa.id);
      } else if (boot.precisaSelecionarPessoa) {
        const u = usePortalClienteAuthStore.getState().user;
        if (inferPortalClienteTipo(u) === "PF" && u?.cpfCnpj) {
          const ensured = await ensurePortalPessoaSession(portalPessoaSessionDeps(), {
            cpfCnpj: u.cpfCnpj,
            force: true,
          });
          if (ensured.status === "ok") {
            const fixed: PortalAuthBootstrapResponse = {
              ...boot,
              pessoa: ensured.pessoa,
              precisaSelecionarPessoa: false,
            };
            authBootstrapCache = fixed;
            minhasPermissoesCache = fixed.permissoes;
            return fixed;
          }
        }
      }
      return boot;
    } catch {
      if (authBootstrapCache) return authBootstrapCache;
      if (stored.permissoes && pessoaLocal?.id && stored.boundPessoaId === pessoaLocal.id) {
        authBootstrapCache = {
          sucesso: true,
          permissoes: stored.permissoes,
          pessoa: pessoaLocal,
          precisaSelecionarPessoa: false,
        };
        return authBootstrapCache;
      }
      authBootstrapCache = {
        sucesso: true,
        permissoes: DEFAULT_PERMISSOES_ROW,
        pessoa: null,
        precisaSelecionarPessoa: !pessoaLocal?.id,
      };
      return authBootstrapCache;
    } finally {
      authBootstrapInflight = null;
    }
  })();

  return authBootstrapInflight;
}

export function portalAuthHealth() {
  return portalJson<PortalAuthHealthResponse>("/portal/auth/health");
}

/** Permissões da pessoa — delega ao bootstrap (sem loop). */
export async function portalMinhasPermissoes(opts?: { force?: boolean }): Promise<PermissoesPessoaRow | null> {
  const st = usePortalClienteAuthStore.getState();
  const cookieMode = isPortalCookieAuthMode();
  if (!st.accessToken?.trim() && cookieMode && !st.sessionHydrated) {
    await portalHydrateSessionFromCookies();
  }
  if (!hasPortalClientSession(usePortalClienteAuthStore.getState())) return null;

  if (!opts?.force && minhasPermissoesCache !== undefined) {
    return minhasPermissoesCache;
  }
  if (minhasPermissoesInflight) {
    return minhasPermissoesInflight;
  }

  minhasPermissoesInflight = portalAuthBootstrap(opts).then((boot) => {
    minhasPermissoesCache = boot.permissoes;
    return boot.permissoes;
  }).finally(() => {
    minhasPermissoesInflight = null;
  });

  return minhasPermissoesInflight;
}

function portalPessoaSessionDeps() {
  return {
    portalValidarPessoa,
    fetchPermissoes: async () => {
      const body = await portalJson<PortalAuthBootstrapResponse>("/portal/auth/minhas-permissoes");
      return body?.permissoes ?? null;
    },
    clearPortalMinhasPermissoesCache,
  };
}

export async function ensurePortalPessoaSessionForPortal(opts?: {
  cpfCnpj?: string;
  pessoaFromLogin?: PortalLoginResponse["pessoaAutorizada"] | null;
  force?: boolean;
}) {
  const { ensurePortalPessoaSession } = await import("@/lib/portal-pessoa-session");
  return ensurePortalPessoaSession(portalPessoaSessionDeps(), opts);
}

export async function bootstrapPortalPessoaIdentidade(opts: {
  cpfCnpj: string;
  pessoaFromLogin?: PortalLoginResponse["pessoaAutorizada"] | null;
}) {
  const { bootstrapPortalPessoaIdentidade: boot } = await import("@/lib/portal-pessoa-session");
  return boot(portalPessoaSessionDeps(), opts);
}

export function fetchKpis() {
  return portalJson<KpisResponse>("/cliente/portal/kpis");
}

export function fetchSlas() {
  return portalJson<SlasResponse>("/cliente/portal/slas");
}

export function fetchCxFinanceiroBoletos() {
  return portalJson<Record<string, unknown>[]>("/cliente/portal/financeiro/boletos");
}

export function fetchCxFinanceiroNfse() {
  return portalJson<Record<string, unknown>[]>("/cliente/portal/financeiro/nfse");
}

export type SolicitacaoRow = {
  id: string;
  protocolo: string;
  status: string;
  versaoCredencial?: number;
  tipoOperacao?: TipoOperacaoSolicitacaoIntent | null;
  createdAt: string;
  updatedAt?: string;
  cliente?: { id: string; razaoSocial: string; nomeFantasia?: string };
  unidades?: { id: string; numeroIso: string; tipo: string }[];
  transporteSolicitacao?: {
    nomeMotorista: string;
    cpfMotorista: string;
    tipoCaminhao: string;
    placaCavalo: string;
    placaCarreta01: string;
    placaCarreta02?: string | null;
  } | null;
  containersSolicitacao?: Array<{
    id: string;
    unidade: string;
    booking: string;
    processo: string;
    tamanho: string;
    tipo: string;
    status: string;
    lacre?: string | null;
    refrigerado: boolean;
    setPoint?: number | null;
    ordem: number;
  }>;
  agendamentoSolicitacao?: {
    dataRef: string;
    turno: string;
    atendimentoEspecial: boolean;
    atendimentoEspecialTexto?: string | null;
  } | null;
  solicitanteContato?: {
    nome: string;
    telefone: string;
    email: string;
  } | null;
  anexosSolicitacao?: Array<{
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    urlS3: string;
    expiresAt: string;
    createdAt?: string;
  }>;
  portaria?: {
    createdAt?: string;
    fotosContainer?: unknown;
    fotosCaminhao?: unknown;
    fotosLacre?: unknown;
    fotosAvarias?: unknown;
  } | null;
  gate?: unknown | null;
  patio?: unknown | null;
  saida?: unknown | null;
};

export type SolicitacoesEscopo = "minhas" | "todas";

export async function fetchSolicitacoesPaginated(params: {
  page?: number;
  limit?: number;
  status?: string;
  createdFrom?: string;
  createdTo?: string;
  protocolo?: string;
  container?: string;
  booking?: string;
  processo?: string;
  orderBy?: string;
  order?: string;
  escopo?: SolicitacoesEscopo;
}) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.status) sp.set("status", params.status);
  if (params.createdFrom) sp.set("createdFrom", params.createdFrom);
  if (params.createdTo) sp.set("createdTo", params.createdTo);
  if (params.protocolo?.trim()) sp.set("protocolo", params.protocolo.trim());
  if (params.container?.trim()) sp.set("container", params.container.trim());
  if (params.booking?.trim()) sp.set("booking", params.booking.trim());
  if (params.processo?.trim()) sp.set("processo", params.processo.trim());
  if (params.orderBy) sp.set("orderBy", params.orderBy);
  if (params.order) sp.set("order", params.order);
  if (params.escopo) sp.set("escopo", params.escopo);
  const q = sp.toString();
  return portalJson<PaginatedResponse<SolicitacaoRow>>(`/cliente/portal/solicitacoes${q ? `?${q}` : ""}`);
}

export function fetchSolicitacao(id: string) {
  return portalJson<SolicitacaoRow>(`/cliente/portal/solicitacoes/${id}`);
}

export type PortalTipoContainerCatalogItem = {
  codigo: string;
  nome: string;
  tamanhos: string[];
  tomadaReefer: boolean;
};

/** Catálogo MDM ativo — mesma base de /cadastros/operacional/tipos-container. */
export function listPortalTiposContainer() {
  return portalJson<{ items: PortalTipoContainerCatalogItem[]; total: number }>(
    "/cliente/portal/catalogo/tipos-container",
  );
}

export type PortalTomadaStatus = {
  unidadeId: string;
  unidadeIso: string;
  conectada: boolean;
  solicitacaoPendente: boolean;
  eventos: Array<{
    tipo: string;
    setPoint: number | null;
    createdAt: string;
    observacao: string | null;
  }>;
};

export function fetchPortalTomadaStatus(iso: string) {
  return portalJson<PortalTomadaStatus>(
    `/cliente/portal/containers/${encodeURIComponent(iso)}/tomada`,
  );
}

export function solicitarTomadaPortal(iso: string, body: { setPoint: number; observacao?: string }) {
  return portalJson<{ unidadeIso: string; status: string; setPoint: number; message: string }>(
    `/cliente/portal/containers/${encodeURIComponent(iso)}/solicitar-tomada`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function fetchSolicitacaoVistorias(id: string) {
  return portalJson<import("@/lib/gate-vistoria").VistoriaPortalRow[]>(
    `/cliente/portal/solicitacoes/${encodeURIComponent(id)}/vistorias`,
  );
}

export type AuditLogUiItem = {
  id: string;
  criadoEm: string;
  acao: string;
  usuarioId: string;
  usuarioNome: string;
  usuarioRole: string;
  deltas: Array<{ campo: string; label: string; antes: unknown; depois: unknown }>;
};

export function fetchSolicitacaoHistoricoAlteracoes(id: string) {
  return portalJson<{ solicitacaoId: string; items: AuditLogUiItem[] }>(
    `/cliente/portal/solicitacoes/${encodeURIComponent(id)}/historico-alteracoes`,
  );
}

export function aprovarSolicitacao(id: string) {
  return portalJson<SolicitacaoRow>(`/cliente/portal/solicitacoes/${id}/aprovar`, { method: "PATCH" });
}

export type UpdatePortalSolicitacaoPayload = {
  localOrigem?: string;
  localDestino?: string;
  transporte?: {
    nomeMotorista: string;
    cpfMotorista: string;
    tipoCaminhao: "LS" | "RODOTREM";
    placaCavalo: string;
    placaCarreta01: string;
    placaCarreta02?: string;
  };
  containers: Array<{
    ordem: number;
    booking?: string;
    processo?: string;
    tamanho: string;
    tipo: string;
    status: "CHEIO" | "VAZIO";
    lacre?: string;
    refrigerado: boolean;
    setPoint?: number;
  }>;
  agendamento: {
    dataRef: string;
    turno: string;
    atendimentoEspecial: boolean;
    atendimentoEspecialTexto?: string;
  };
  solicitante: {
    nome: string;
    telefone: string;
    email: string;
  };
};

export function atualizarSolicitacaoPortal(id: string, body: UpdatePortalSolicitacaoPayload) {
  return portalJson<SolicitacaoRow>(`/cliente/portal/solicitacoes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function cancelarSolicitacaoPortal(id: string) {
  return portalJson<SolicitacaoRow>(
    `/cliente/portal/solicitacoes/${encodeURIComponent(id)}/cancelar`,
    { method: "POST" },
  );
}

export type ModalidadeTransporte = "FROTA_CLIENTE" | "FROTA_FL";
export type StatusCargaAgendamento = "CHEIO" | "VAZIO";
export type TipoOperacaoAgendamento = "GATE_IN" | "GATE_OUT";

export type CreateAgendamentoPortalPayload = {
  numeroIso: string;
  dataRef: string;
  turno: string;
  tipoOperacao: TipoOperacaoAgendamento;
  modalidadeTransporte: ModalidadeTransporte;
  statusCarga: StatusCargaAgendamento;
  localOrigem?: string;
  localDestino?: string;
  solicitacaoId?: string;
};

export type AgendamentoTerminalRow = {
  id: string;
  numeroIso: string;
  dataRef: string;
  turno: string;
  tipoOperacao: TipoOperacaoAgendamento;
  modalidadeTransporte: ModalidadeTransporte;
  statusCarga: StatusCargaAgendamento;
  localOrigem?: string | null;
  localDestino?: string | null;
  status: string;
};

export function criarAgendamentoPortal(body: CreateAgendamentoPortalPayload) {
  return portalJson<AgendamentoTerminalRow>("/cliente/portal/agendamentos", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Intenção operacional enviada pelo portal (mapeada para GATE_IN/OUT + modalidade no backend). */
export type TipoOperacaoSolicitacaoIntent =
  | "SOLICITAR_BAIXA"
  | "SOLICITAR_IMPORTACAO_COLETA_DEPOT"
  | "SOLICITAR_COLETA"
  | "SOLICITAR_EXPORTACAO_ENTREGA_DEPOT";

/** Corpo alinhado a `CreateSolicitacaoV2Dto` (backend). */
export type CreateSolicitacaoV2Payload = {
  tipoOperacao: TipoOperacaoSolicitacaoIntent;
  localOrigem?: string;
  localDestino?: string;
  transporte?: {
    nomeMotorista: string;
    cpfMotorista: string;
    tipoCaminhao: "LS" | "RODOTREM";
    placaCavalo: string;
    placaCarreta01: string;
    placaCarreta02?: string;
  };
  containers: Array<{
    unidade: string;
    booking?: string;
    processo?: string;
    tamanho: string;
    tipo: string;
    status: "CHEIO" | "VAZIO";
    lacre?: string;
    refrigerado: boolean;
    setPoint?: number;
    ordem: number;
  }>;
  agendamento: {
    dataRef: string;
    turno: string;
    atendimentoEspecial: boolean;
    atendimentoEspecialTexto?: string;
  };
  solicitante: {
    nome: string;
    telefone: string;
    email: string;
  };
  /** Import/coleta — ISO 8601 */
  previsaoRetirada?: string;
  /** Export — ISO 8601 */
  bookingDeadline?: string;
};

export function criarSolicitacaoV2(body: CreateSolicitacaoV2Payload) {
  return portalJson<SolicitacaoRow>("/portal/v2/solicitacoes", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Cria solicitação e persiste anexos na mesma requisição (`POST /v2/solicitacoes/com-anexos`). */
export function criarSolicitacaoV2ComAnexos(body: CreateSolicitacaoV2Payload, files: File[]) {
  const fd = new FormData();
  fd.append("payload", JSON.stringify(body));
  for (const f of files) fd.append("files", f);
  return portalMultipartJson<SolicitacaoRow>("/portal/v2/solicitacoes/com-anexos", fd, "POST");
}

export function uploadAnexoSolicitacaoV2(solicitacaoId: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return portalMultipartJson<{
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    urlS3: string;
    expiresAt: string;
  }>(`/portal/v2/solicitacoes/${encodeURIComponent(solicitacaoId)}/anexos`, fd, "POST");
}

function slicePage<T>(rows: T[], page: number, limit: number): PaginatedResponse<T> {
  const p = Math.max(1, page);
  const l = Math.max(1, limit);
  const start = (p - 1) * l;
  const items = rows.slice(start, start + l);
  const totalPages = Math.max(1, Math.ceil(rows.length / l));
  return {
    items,
    total: rows.length,
    page: p,
    limit: l,
    meta: { total: rows.length, page: p, limit: l, totalPages },
  };
}

export async function fetchFaturamentoPaginated(params: { page?: number; limit?: number; periodo?: string }) {
  const rows = await portalJson<Record<string, unknown>[]>("/cliente/portal/financeiro/faturas");
  void params.periodo;
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  return slicePage(rows, page, limit);
}

export async function fetchFaturamento(id: string) {
  const rows = await portalJson<Record<string, unknown>[]>("/cliente/portal/financeiro/faturas");
  const row = rows.find((r) => String(r.id) === String(id));
  if (!row) throw new ApiError("Fatura não encontrada", 404);
  return row;
}

export async function fetchBoletosPaginated(params: { page?: number; limit?: number }) {
  const rows = await portalJson<Record<string, unknown>[]>("/cliente/portal/financeiro/boletos");
  const page = params.page ?? 1;
  const limit = params.limit ?? 100;
  return slicePage(rows, page, limit);
}

export async function fetchBoleto(id: string) {
  const rows = await portalJson<Record<string, unknown>[]>("/cliente/portal/financeiro/boletos");
  const row = rows.find((r) => String(r.id) === String(id));
  if (!row) throw new ApiError("Boleto não encontrado", 404);
  return row;
}

export async function fetchNfsePaginated(params: { page?: number; limit?: number }) {
  const rows = await portalJson<Record<string, unknown>[]>("/cliente/portal/financeiro/nfse");
  const page = params.page ?? 1;
  const limit = params.limit ?? 50;
  return slicePage(rows, page, limit);
}

export async function fetchNfse(id: string) {
  const rows = await portalJson<Record<string, unknown>[]>("/cliente/portal/financeiro/nfse");
  const row = rows.find((r) => String(r.id) === String(id));
  if (!row) throw new ApiError("NFSe não encontrada", 404);
  return row;
}

/** Fatura Gate-Out (armazenagem) com links NFS-e / boleto / PIX — H9. */
export type FaturaArmazenagemPortal = {
  id: string;
  valorTotal: number | string;
  dataEmissao: string;
  statusPagamento: string;
  linkNfse: string | null;
  linkBoleto: string | null;
  linkPix: string | null;
  numeroRps: string | null;
  serieRps: string | null;
  preFatura?: {
    containerIso?: string;
    diasCobrados?: number;
  } | null;
};

export async function fetchFaturasArmazenagemPaginated(params: { page?: number; limit?: number }) {
  const rows = await portalJson<FaturaArmazenagemPortal[]>("/cliente/portal/financeiro/faturas-armazenagem");
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  return slicePage(rows, page, limit);
}

export async function fetchFaturaArmazenagem(id: string) {
  const rows = await portalJson<FaturaArmazenagemPortal[]>("/cliente/portal/financeiro/faturas-armazenagem");
  const row = rows.find((r) => String(r.id) === String(id));
  if (!row) throw new ApiError("Fatura de armazenagem não encontrada", 404);
  return row;
}

/** Resposta `GET /cliente/portal/dashboard` (consolidado KPIs + solicitações + financeiro). */
export type PortalDashboardConsolidatedResponse = {
  cliente: {
    id: string;
    nome: string;
    tipo: string;
    cpfCnpj: string;
    emailNfse: string | null;
    inscricaoEstadual?: string | null;
    endereco: {
      cep: string;
      logradouro: string;
      numero: string;
      complemento: string | null;
      bairro: string;
      cidade: string;
      uf: string;
      codigoIbge: string;
    };
  } | null;
  solicitacoes: {
    abertas: number;
    emAndamento: number;
    concluidas: number;
    canceladas: number;
    ultimas: { id: string; protocolo: string; status: string; createdAt: string }[];
  };
  totalSolicitacoes: number;
  solicitacoesRecentes: SolicitacaoRow[];
  kpis: { abertas: number; emAndamento: number; concluídas: number };
  kpisCx: KpisResponse;
  financeiro: {
    boletosPendentes: number;
    nfseEmitidas: number;
    faturadoMes: number;
    totalFaturadoPeriodo: number;
  };
  slas: { cumpridos: number; violados: number; desempenho: number };
  slasCx: SlasResponse;
  unidades: {
    total: number;
    import: number;
    export: number;
    gateIn: number;
    gateOut: number;
  };
  tendencias: {
    solicitacoesMesVsAnteriorPct: number;
    faturadoMesVsAnteriorPct: number;
  };
  trackingSample: SolicitacaoRow[];
  solicitacoesHoje: SolicitacaoRow[];
  recent: {
    items: SolicitacaoRow[];
    total: number;
    page: number;
    limit: number;
    orderBy: string;
    order: string;
  };
  meta: {
    tenantId: string;
    slasMinutosMeta: Record<string, number> | null;
    cacheHit?: boolean;
    slaAmostraConcluidas?: number;
  };
  isBloqueadoFinanceiramente?: boolean;
  statusCadastro?: "PENDENTE_ANALISE_FINANCEIRA" | "APROVADO" | "REJEITADO" | null;
  validacaoDominio?: "APROVADO" | "DIVERGENTE" | "INDISPONIVEL" | null;
  condicaoPagamento?: string | null;
  cadastroOperacionalLiberado?: boolean;
};

/** @deprecated Use `PortalDashboardConsolidatedResponse` e `cliente.nome`. */
export type PortalDashboardResponse = PortalDashboardConsolidatedResponse;

/**
 * Dashboard CX consolidado — uma única chamada substitui kpis + slas + solicitações + financeiro.
 * Aceita string legada `(clienteId)` ou objeto com paginação da lista recente.
 */
export function fetchPortalDashboard(
  opts?: string | { clienteId?: string; recentPage?: number; recentLimit?: number },
) {
  const o = typeof opts === "string" ? { clienteId: opts } : opts ?? {};
  const sp = new URLSearchParams();
  if (o.clienteId) sp.set("clienteId", o.clienteId);
  if (o.recentPage != null) sp.set("recentPage", String(o.recentPage));
  if (o.recentLimit != null) sp.set("recentLimit", String(o.recentLimit));
  const q = sp.toString();
  return portalJson<PortalDashboardConsolidatedResponse>(
    `/cliente/portal/dashboard${q ? `?${q}` : ""}`,
  ).then(normalizePortalDashboard);
}

function portalOnboardingHeaders(extra?: HeadersInit): Headers {
  const h = new Headers(extra);
  h.set("Content-Type", "application/json");
  const t = usePortalClienteAuthStore.getState().accessToken?.trim();
  if (t) h.set("Authorization", `Bearer ${t}`);
  return h;
}

async function throwPortalOnboardingError(res: Response, fallback: string): Promise<never> {
  const text = await res.text();
  let msg = fallback;
  let detail: string | undefined;
  try {
    const j = JSON.parse(text) as {
      message?: string | string[] | Record<string, unknown>;
      detail?: string;
      statusCode?: number;
    };
    if (typeof j.detail === "string" && j.detail.trim()) detail = j.detail.trim();
    if (typeof j.message === "string" && j.message.trim()) {
      msg = j.message.trim();
    } else if (Array.isArray(j.message)) {
      msg = j.message.join(", ");
    } else if (j.message && typeof j.message === "object") {
      const inner = j.message as { message?: string; detail?: string };
      if (typeof inner.detail === "string" && inner.detail.trim()) detail = inner.detail.trim();
      if (typeof inner.message === "string" && inner.message.trim()) msg = inner.message.trim();
    }
  } catch {
    if (text?.trim()) msg = text.trim();
  }
  throw new ApiError(msg, res.status, detail);
}

/** Mapeia mensagem bruta do backend para toast amigável no cadastro portal. */
export function resolvePortalRegisterErrorMessage(
  message: string,
  fallback = "Erro ao salvar cadastro",
): string {
  const m = (message ?? "").trim();
  if (!m) return fallback;

  if (
    /Documento deve|CPF inválido|CPF é obrigatório|11 dígitos|Pessoa Física.*CPF|somente CPF/i.test(
      m,
    )
  ) {
    return "CPF inválido — envie apenas números";
  }
  if (/CNPJ inválido|CNPJ é obrigatório|14 dígitos/i.test(m)) {
    return "CNPJ inválido — envie apenas números";
  }
  if (/CEP/i.test(m)) {
    return "CEP não encontrado — revise ou continue preenchendo manualmente.";
  }
  return m || fallback;
}

/** Cadastro portal — PF (NFS-e) ou PJ fiscal completo (`POST /portal/register`). */
export type PortalClienteRegisterPayload =
  | {
      nomeCompleto: string;
      tipo: "PF";
      cpfCnpj: string;
      dataNascimento?: string;
      email: string;
      telefone: string;
      telefoneContato?: string;
      emailNfse?: string;
      enderecoLogradouro: string;
      enderecoNumero: string;
      enderecoComplemento?: string;
      enderecoBairro: string;
      enderecoCidade: string;
      enderecoUf: string;
      enderecoCep: string;
      codigoMunicipioIbge?: string;
      password: string;
      aceiteTermos: boolean;
      pessoasAutorizadas?: Array<{
        nome: string;
        email: string;
        cpf: string;
        telefone?: string;
        permissoes?: PermissoesPessoaRow;
      }>;
    }
  | {
      razaoSocial: string;
      nomeFantasia: string;
      tipo: "PJ";
      cpfCnpj: string;
      inscricaoMunicipal?: string;
      inscricaoEstadual?: string;
      isentoIE: boolean;
      email: string;
      emailNfse: string;
      telefone: string;
      enderecoLogradouro: string;
      enderecoNumero: string;
      enderecoComplemento?: string;
      enderecoBairro: string;
      enderecoCidade: string;
      enderecoUf: string;
      enderecoCep: string;
      codigoMunicipioIbge?: string;
      responsavel: string;
      responsavelTelefone: string;
      responsavelEmail: string;
      password: string;
      aceiteTermos: boolean;
      pessoasAutorizadas?: Array<{
        nome: string;
        email: string;
        cpf: string;
        telefone?: string;
        permissoes?: PermissoesPessoaRow;
      }>;
      transportadorasAutorizadas?: Array<{
        cnpj: string;
        razaoSocial: string;
        emailContato: string;
      }>;
    };

/** IAM público — não usa `portalRequest` (sem Bearer obrigatório). Header Bearer só se já existir sessão portal. */
export async function portalClienteRegister(data: PortalClienteRegisterPayload): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${getApiBase()}/portal/register`, {
    method: "POST",
    headers: portalOnboardingHeaders(),
    body: JSON.stringify(data),
    credentials: "include",
  });
  if (!res.ok) await throwPortalOnboardingError(res, "Falha no cadastro");
  return parseJson<{ ok: boolean; message: string }>(res);
}

/** Cadastro portal — não bloqueia por falha prévia de CEP (IBGE resolvido no backend quando possível). */
export async function tryPortalClienteRegister(
  data: PortalClienteRegisterPayload,
): Promise<{ ok: boolean; message: string }> {
  return portalClienteRegister(data);
}

export type PortalCepLookupResponse = {
  cepValido: boolean;
  ok?: boolean;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  ibge: string | null;
  cep: string;
};

/** Consulta CEP no backend — fallback silencioso (nunca lança por indisponibilidade externa). */
export async function portalLookupCepSafe(cepDigits: string): Promise<PortalCepLookupResponse | null> {
  const raw = cepDigits.replace(/\D/g, "");
  if (raw.length !== 8) return null;
  try {
    const res = await fetch(`${getApiBase()}/address/cep/${raw}`, {
      headers: { Accept: "application/json" },
    });
    if (res.status === 400) return null;
    if (!res.ok) {
      return {
        cepValido: false,
        cep: raw,
        logradouro: "",
        bairro: "",
        cidade: "",
        uf: "",
        ibge: null,
      };
    }
    return parseJson<PortalCepLookupResponse>(res);
  } catch {
    return {
      cepValido: false,
      cep: raw,
      logradouro: "",
      bairro: "",
      cidade: "",
      uf: "",
      ibge: null,
    };
  }
}

export async function portalClienteEsqueciSenha(
  email: string,
): Promise<{ ok?: boolean; message: string }> {
  const res = await fetch(`${getApiBase()}/portal/esqueci-senha`, {
    method: "POST",
    headers: portalOnboardingHeaders(),
    body: JSON.stringify({ email }),
    credentials: "include",
  });
  if (!res.ok) await throwPortalOnboardingError(res, "Não foi possível enviar a solicitação");
  return parseJson<{ ok?: boolean; message: string }>(res);
}

export async function portalClienteRedefinirSenha(token: string, novaSenha: string): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${getApiBase()}/portal/redefinir-senha`, {
    method: "POST",
    headers: portalOnboardingHeaders(),
    body: JSON.stringify({ token, novaSenha }),
    credentials: "include",
  });
  if (!res.ok) await throwPortalOnboardingError(res, "Não foi possível redefinir a senha");
  return parseJson<{ ok: boolean; message: string }>(res);
}

/** GET `/cliente/security/risk-profile` — banner e painel de segurança. */
export type PortalRiskProfileResponse = {
  riscoGlobal: number | null;
  /** Presente quando o servidor não pôde avaliar (CORS/headers/rate limit/engine). */
  status?: string;
  motivo?: string;
  risco?: string;
  ultimasAnomalias: unknown[];
  fingerprintAtual: string;
  fingerprintSelo: "confiavel" | "novo" | "suspeito";
  riscoPorDispositivo: Array<{ sessionId: string; fingerprint: string; score: number }>;
  recomendacao: string;
};

const RISK_PROFILE_MIN_INTERVAL_MS = 5000;
const RISK_PROFILE_ERROR_COOLDOWN_MS = 30_000;
const RISK_ENGINE_SKIP_COOLDOWN_MS = 30_000;

let riskProfileMemo: PortalRiskProfileResponse | null = null;
let riskProfileMemoAt = 0;
let riskProfileCooldownUntil = 0;

function portalRiskProfileFallback(): PortalRiskProfileResponse {
  return {
    riscoGlobal: null,
    status: "unable-to-evaluate",
    motivo: "client-offline",
    ultimasAnomalias: [],
    fingerprintAtual: "",
    fingerprintSelo: "novo",
    riscoPorDispositivo: [],
    recomendacao: "",
  };
}

function portalRiskProfileEngineSkipped(): PortalRiskProfileResponse {
  return {
    riscoGlobal: null,
    status: "unavailable",
    motivo: "security-engine-not-ok",
    ultimasAnomalias: [],
    fingerprintAtual: "",
    fingerprintSelo: "novo",
    riscoPorDispositivo: [],
    recomendacao: "",
  };
}

/**
 * Perfil de risco com debounce (mín. 5s entre chamadas HTTP), backoff 30s após erro/CORS/429
 * e fallback estável para evitar loops no banner/dashboard.
 * Se `securityEngine !== ok` no health, não chama a API por 30s.
 */
export async function fetchPortalRiskProfile(): Promise<PortalRiskProfileResponse> {
  const now = Date.now();
  const health = getPortalHealthSnapshot();
  if (health && health.securityEngine !== "ok") {
    riskProfileCooldownUntil = Math.max(riskProfileCooldownUntil, now + RISK_ENGINE_SKIP_COOLDOWN_MS);
    return riskProfileMemo ?? portalRiskProfileEngineSkipped();
  }

  if (now < riskProfileCooldownUntil) {
    return riskProfileMemo ?? portalRiskProfileFallback();
  }
  if (riskProfileMemo && now - riskProfileMemoAt < RISK_PROFILE_MIN_INTERVAL_MS) {
    return riskProfileMemo;
  }

  try {
    const res = await portalRequest("/cliente/security/risk-profile");
    if (!res.ok) {
      riskProfileCooldownUntil = Date.now() + RISK_PROFILE_ERROR_COOLDOWN_MS;
      if (res.status === 429) {
        return riskProfileMemo ?? portalRiskProfileFallback();
      }
      return riskProfileMemo ?? portalRiskProfileFallback();
    }
    const data = await parseJson<PortalRiskProfileResponse>(res);
    riskProfileMemo = data;
    riskProfileMemoAt = Date.now();
    return data;
  } catch (e) {
    riskProfileCooldownUntil = Date.now() + RISK_PROFILE_ERROR_COOLDOWN_MS;
    if (e instanceof ApiError) {
      const st = e.status;
      if (st === 429 || st === 0) {
        return riskProfileMemo ?? portalRiskProfileFallback();
      }
    }
    if (e instanceof TypeError) {
      return riskProfileMemo ?? portalRiskProfileFallback();
    }
    return riskProfileMemo ?? portalRiskProfileFallback();
  }
}

export function fetchPortalIntrusoes() {
  return portalJson<unknown[]>("/cliente/security/intrusoes");
}

export function fetchPortalSecuritySessoes() {
  return portalJson<
    Array<
      Record<string, unknown> & {
        sessionId?: string;
        riskScore?: number;
        perigosa?: boolean;
      }
    >
  >("/cliente/security/sessoes");
}

export function fetchPortalGeoRecentes() {
  return portalJson<{ pontos: Array<{ lat: number; lon: number }> }>("/cliente/security/geo-recentes");
}

export function portalRevogarOutrasSessoes() {
  return portalJson<{ revogadas: number }>("/cliente/security/sessoes/revogar-outras", { method: "POST" });
}

/** Encerra uma sessão própria (mesmo contrato do portal legado). */
export function portalEncerrarSessao(sessionId: string) {
  return portalJson<void>(
    `/cliente/portal/sessoes-ativas/${encodeURIComponent(sessionId)}`,
    { method: "DELETE" },
  );
}

export function portalContainerTimeline(isoDisplay: string) {
  const iso = stripContainerISO(isoDisplay);
  return portalJson<ContainerTimelineResponse>(
    `/client/container/${encodeURIComponent(iso)}/timeline`,
  );
}

export function portalContainerPreFatura(isoDisplay: string) {
  const iso = stripContainerISO(isoDisplay);
  return portalJson<import("@/lib/armazenagem-pre-fatura").PreFaturaPortalResponse>(
    `/client/container/${encodeURIComponent(iso)}/pre-fatura`,
  );
}
