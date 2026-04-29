import { useMotoristaAuthStore } from "@/stores/motorista-auth-store";
import { ApiError, authRefresh, defaultApiCredentials, getApiBase } from "@/lib/api/portal-client";
import { applyCsrfHeaders } from "@/lib/csrf-client";

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError("Resposta inválida da API", res.status);
  }
}

export { ApiError } from "@/lib/api/portal-client";

export async function motoristaRequest(path: string, init?: RequestInit): Promise<Response> {
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

  const state = useMotoristaAuthStore.getState();
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
        const { clearMotoristaSessionCookie } = await import("@/lib/auth-motorista-cookie");
        clearMotoristaSessionCookie();
      }
      throw new ApiError("Sessão expirada", 401);
    }
  }

  return res;
}

export async function motoristaJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await motoristaRequest(path, init);
  if (res.status === 401) {
    useMotoristaAuthStore.getState().clear();
    if (typeof window !== "undefined") {
      const { clearMotoristaSessionCookie } = await import("@/lib/auth-motorista-cookie");
      clearMotoristaSessionCookie();
    }
    throw new ApiError("Não autorizado", 401);
  }
  if (!res.ok) {
    const err = await res.text();
    throw new ApiError(err || `Erro HTTP ${res.status}`, res.status);
  }
  return parseJson<T>(res);
}

export async function motoristaFormData(path: string, form: FormData): Promise<Response> {
  return motoristaRequest(path, { method: "POST", body: form });
}

/** GET solicitação: tenta rota corporativa; em 403 tenta portal CX. */
export async function motoristaFetchSolicitacao(id: string): Promise<Record<string, unknown>> {
  try {
    return await motoristaJson<Record<string, unknown>>(`/solicitacoes/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) {
      return motoristaJson<Record<string, unknown>>(`/cliente/portal/solicitacoes/${id}`);
    }
    throw e;
  }
}
