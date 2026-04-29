import { applyCsrfHeaders } from "@/lib/csrf-client";
import { usePortalAuthStore } from "@/stores/portal-store";
import type {
  AuthLoginResponse,
  AuthMeResponse,
  KpisResponse,
  PaginatedResponse,
  SlasResponse,
} from "@/lib/api/types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

export function defaultApiCredentials(): RequestCredentials {
  if (typeof window === "undefined") return "same-origin";
  try {
    return new URL(getApiBase()).origin !== window.location.origin ? "include" : "same-origin";
  } catch {
    return "same-origin";
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError("Resposta inválida da API", res.status);
  }
}

export async function authLogin(
  email: string,
  password: string,
  opts?: { cookieMode?: boolean },
): Promise<AuthLoginResponse> {
  const cookieMode = opts?.cookieMode ?? false;
  const res = await fetch(`${getApiBase()}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookieMode ? { "X-RL-Auth-Cookie": "1" } : {}),
    },
    body: JSON.stringify({ email, password }),
    credentials: cookieMode ? "include" : defaultApiCredentials(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new ApiError(err || "Falha no login", res.status);
  }
  return parseJson<AuthLoginResponse>(res);
}

export async function authRefresh(
  refreshToken: string | null | undefined,
  opts?: { cookieMode?: boolean },
): Promise<Pick<AuthLoginResponse, "accessToken" | "refreshToken">> {
  const cookieMode = opts?.cookieMode ?? false;
  if (!cookieMode && (!refreshToken || refreshToken.length < 10)) {
    throw new ApiError("Sessão expirada", 401);
  }
  const res = await fetch(`${getApiBase()}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookieMode ? { "X-RL-Auth-Cookie": "1" } : {}),
    },
    body: JSON.stringify(cookieMode && !refreshToken ? {} : { refreshToken }),
    credentials: cookieMode ? "include" : defaultApiCredentials(),
  });
  if (!res.ok) {
    throw new ApiError("Sessão expirada", res.status);
  }
  return parseJson(res);
}

export async function authMe(accessToken: string): Promise<AuthMeResponse> {
  const res = await fetch(`${getApiBase()}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) throw new ApiError(await res.text(), res.status);
  return parseJson<AuthMeResponse>(res);
}

/** Requisição autenticada com refresh automático (JWT corporativo). */
export async function portalRequest(path: string, init?: RequestInit): Promise<Response> {
  const base = getApiBase();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const doFetch = (token: string | null) => {
    const headers = new Headers(init?.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    applyCsrfHeaders(headers, init?.method);
    const credentials = init?.credentials ?? defaultApiCredentials();
    return fetch(url, { ...init, headers, credentials });
  };

  const state = usePortalAuthStore.getState();
  let accessToken = state.accessToken;
  const { refreshToken, setSession, user, clear } = state;
  let res = await doFetch(accessToken);

  if (res.status === 401 && refreshToken) {
    try {
      const next = await authRefresh(refreshToken);
      setSession(next.accessToken, next.refreshToken, user);
      accessToken = next.accessToken;
      res = await doFetch(accessToken);
    } catch {
      clear();
      if (typeof window !== "undefined") {
        const { clearPortalSessionCookie } = await import("@/lib/auth-cookie");
        clearPortalSessionCookie();
      }
      throw new ApiError("Sessão expirada", 401);
    }
  }

  return res;
}

export async function portalJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await portalRequest(path, init);
  if (res.status === 401) {
    usePortalAuthStore.getState().clear();
    if (typeof window !== "undefined") {
      const { clearPortalSessionCookie } = await import("@/lib/auth-cookie");
      clearPortalSessionCookie();
    }
    throw new ApiError("Não autorizado", 401);
  }
  if (!res.ok) {
    const err = await res.text();
    throw new ApiError(err || `Erro HTTP ${res.status}`, res.status);
  }
  return parseJson<T>(res);
}

/** GET /auth/me com refresh silencioso (JWT corporativo). */
export function fetchAuthMe() {
  return portalJson<AuthMeResponse>("/auth/me");
}

/* ——— CX dashboard (Bearer: JWT corporativo cliente) ——— */

export function fetchKpis() {
  return portalJson<KpisResponse>("/cliente/portal/kpis");
}

export function fetchSlas() {
  return portalJson<SlasResponse>("/cliente/portal/slas");
}

/** Mesma visão financeira do CX (read-only). */
export function fetchCxFinanceiroBoletos() {
  return portalJson<Record<string, unknown>[]>("/cliente/portal/financeiro/boletos");
}

export function fetchCxFinanceiroNfse() {
  return portalJson<Record<string, unknown>[]>("/cliente/portal/financeiro/nfse");
}

/* ——— Portal cliente (Role.CLIENTE) ——— */

export type SolicitacaoRow = {
  id: string;
  protocolo: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  cliente?: { id: string; nome: string };
  unidades?: { id: string; numeroIso: string; tipo: string }[];
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

export async function fetchSolicitacoesPaginated(params: {
  page?: number;
  limit?: number;
  status?: string;
  createdFrom?: string;
  createdTo?: string;
  protocolo?: string;
  orderBy?: string;
  order?: string;
}) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.status) sp.set("status", params.status);
  if (params.createdFrom) sp.set("createdFrom", params.createdFrom);
  if (params.createdTo) sp.set("createdTo", params.createdTo);
  if (params.protocolo?.trim()) sp.set("protocolo", params.protocolo.trim());
  if (params.orderBy) sp.set("orderBy", params.orderBy);
  if (params.order) sp.set("order", params.order);
  const q = sp.toString();
  return portalJson<PaginatedResponse<SolicitacaoRow>>(`/cliente/portal/solicitacoes${q ? `?${q}` : ""}`);
}

export function fetchSolicitacao(id: string) {
  return portalJson<SolicitacaoRow>(`/cliente/portal/solicitacoes/${id}`);
}

export function aprovarSolicitacao(id: string) {
  return portalJson<SolicitacaoRow>(`/portal/solicitacoes/${id}/aprovar`, { method: "PATCH" });
}

export async function fetchFaturamentoPaginated(params: { page?: number; limit?: number; periodo?: string }) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.periodo) sp.set("periodo", params.periodo);
  const q = sp.toString();
  return portalJson<PaginatedResponse<Record<string, unknown>>>(`/portal/faturamento${q ? `?${q}` : ""}`);
}

export function fetchFaturamento(id: string) {
  return portalJson<Record<string, unknown>>(`/portal/faturamento/${id}`);
}

export async function fetchBoletosPaginated(params: { page?: number; limit?: number }) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  const q = sp.toString();
  return portalJson<{
    items: Record<string, unknown>[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }>(`/portal/boletos${q ? `?${q}` : ""}`);
}

export function fetchBoleto(id: string) {
  return portalJson<Record<string, unknown>>(`/portal/boletos/${id}`);
}

export async function fetchNfsePaginated(params: { page?: number; limit?: number }) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  const q = sp.toString();
  return portalJson<{
    items: Record<string, unknown>[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }>(`/portal/nfse${q ? `?${q}` : ""}`);
}

export function fetchNfse(id: string) {
  return portalJson<Record<string, unknown>>(`/portal/nfse/${id}`);
}

export function fetchCliente(id: string) {
  return portalJson<Record<string, unknown>>(`/clientes/${id}`);
}
