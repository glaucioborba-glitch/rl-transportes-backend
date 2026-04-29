import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { isAuthHttpOnlyMode } from "@/lib/auth-mode";
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

function cookieModeFetchInit(): { credentials: RequestCredentials; headers: Record<string, string> } {
  const cookieMode = isAuthHttpOnlyMode();
  return {
    credentials: cookieMode ? "include" : defaultApiCredentials(),
    headers: cookieMode ? { "X-RL-Auth-Cookie": "1" } : {},
  };
}

/** Requisição autenticada (operadores / gestão) com refresh silencioso. */
export async function staffRequest(path: string, init?: RequestInit): Promise<Response> {
  const base = getApiBase();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const { credentials, headers: cookieHeaders } = cookieModeFetchInit();

  const doFetch = (token: string | null) => {
    const headers = new Headers(init?.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    for (const [k, v] of Object.entries(cookieHeaders)) {
      if (!headers.has(k)) headers.set(k, v);
    }
    applyCsrfHeaders(headers, init?.method);
    return fetch(url, { ...init, headers, credentials });
  };

  const state = useStaffAuthStore.getState();
  let accessToken = state.accessToken;
  const { refreshToken, setSession, user, clear } = state;
  const useCookies = isAuthHttpOnlyMode();
  let res = await doFetch(accessToken);

  if (res.status === 401 && (refreshToken || useCookies)) {
    try {
      const next = await authRefresh(useCookies ? null : refreshToken, { cookieMode: useCookies });
      if (useCookies) {
        setSession(null, null, user);
      } else {
        setSession(next.accessToken, next.refreshToken, user);
      }
      accessToken = useCookies ? null : next.accessToken;
      res = await doFetch(accessToken);
    } catch {
      clear();
      if (typeof window !== "undefined") {
        const { clearStaffSessionCookie } = await import("@/lib/auth-staff-cookie");
        clearStaffSessionCookie();
      }
      throw new ApiError("Sessão expirada", 401);
    }
  }

  return res;
}

export async function staffJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await staffRequest(path, init);
  if (res.status === 401) {
    useStaffAuthStore.getState().clear();
    if (typeof window !== "undefined") {
      const { clearStaffSessionCookie } = await import("@/lib/auth-staff-cookie");
      clearStaffSessionCookie();
    }
    throw new ApiError("Não autorizado", 401);
  }
  if (!res.ok) {
    const err = await res.text();
    throw new ApiError(err || `Erro HTTP ${res.status}`, res.status);
  }
  return parseJson<T>(res);
}

/** GET opcional: `null` quando 404/405; demais erros (401, 5xx) propagam como `staffJson`. */
export async function staffTryJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  const res = await staffRequest(path, init);
  if (res.status === 401) {
    useStaffAuthStore.getState().clear();
    if (typeof window !== "undefined") {
      const { clearStaffSessionCookie } = await import("@/lib/auth-staff-cookie");
      clearStaffSessionCookie();
    }
    throw new ApiError("Não autorizado", 401);
  }
  if (res.status === 404 || res.status === 405) {
    return null;
  }
  if (!res.ok) {
    const err = await res.text();
    throw new ApiError(err || `Erro HTTP ${res.status}`, res.status);
  }
  return parseJson<T>(res);
}

/** multipart sem forçar JSON no parse */
export async function staffFormData(path: string, form: FormData): Promise<Response> {
  return staffRequest(path, { method: "POST", body: form });
}
