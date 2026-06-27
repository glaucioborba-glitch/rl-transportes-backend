import type { AuthLoginResponse } from "@/lib/api/types";
import { getDeviceSecurityHeaders } from "@/lib/device-client-headers";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Resposta padronizada quando a API está inacessível (rede / infra). */
export type CorporateAuthFailure = {
  ok: false;
  status: number;
  erro: string;
};

function isNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (error instanceof DOMException && error.name === "AbortError") return false;
  if (error instanceof Error) {
    return /failed to fetch|networkerror|load failed|fetch failed/i.test(error.message);
  }
  return false;
}

export function toCorporateAuthFailure(error: unknown): CorporateAuthFailure {
  if (error instanceof ApiError) {
    return { ok: false, status: error.status, erro: error.message };
  }
  if (isNetworkFailure(error)) {
    return {
      ok: false,
      status: 503,
      erro: "Servidor indisponível no momento. Verifique sua conexão ou tente novamente em instantes.",
    };
  }
  const msg = error instanceof Error && error.message ? error.message : "Erro inesperado";
  return { ok: false, status: 0, erro: msg };
}

export function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
}

export function defaultApiCredentials(): RequestCredentials {
  return typeof window === "undefined" ? "same-origin" : "include";
}

function authUrl(path: "login" | "refresh"): string {
  if (typeof window === "undefined") return `${getApiBase()}/auth/${path}`;
  return `/api/auth/${path}`;
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

const LOGIN_TIMEOUT_MS = 25_000;

/** Remove máscara — enviar sempre somente dígitos ao backend. */
export function sanitizeCorporateDocumento(raw: string): string {
  return String(raw ?? "").replace(/\D/g, "");
}

export type StaffLoginPayload = {
  documento?: string;
  cpfCnpj?: string;
  password: string;
};

/** Monta body do POST /auth/login com documento sempre limpo. */
export function buildStaffLoginBody(data: StaffLoginPayload): { documento: string; password: string } {
  const raw = data.documento ?? data.cpfCnpj ?? "";
  return {
    documento: String(raw).replace(/\D/g, ""),
    password: data.password,
  };
}

/** STAFF / motorista (JWT corporativo): não usar no Portal Cliente — use `portalClienteLogin`. */
export async function authLogin(
  documento: string,
  password: string,
  opts?: { cookieMode?: boolean },
): Promise<AuthLoginResponse> {
  const cookieMode = opts?.cookieMode ?? false;
  const documentoLimpo = sanitizeCorporateDocumento(documento);
  const payload = buildStaffLoginBody({ documento: documentoLimpo, password });
  const apiBase = getApiBase();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);
  let res: Response;
  try {
    const devHeaders = typeof window !== "undefined" ? await getDeviceSecurityHeaders() : {};
    if (cookieMode && typeof window !== "undefined") {
      res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          ...devHeaders,
          "X-RL-Auth-Cookie": "1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } else {
      res = await fetch(authUrl("login"), {
        method: "POST",
        headers: { ...devHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: typeof window !== "undefined" ? "include" : "same-origin",
        signal: controller.signal,
      });
    }
  } catch (e: unknown) {
    const aborted =
      (e instanceof DOMException && e.name === "AbortError") ||
      (e instanceof Error && e.name === "AbortError");
    if (aborted) {
      throw new ApiError(
        `Tempo esgotado ao contatar a API (${apiBase}). Verifique se o Nest está rodando e se REDIS está acessível.`,
        0,
      );
    }
    const failure = toCorporateAuthFailure(e);
    if (failure.status === 503) {
      throw new ApiError(failure.erro, failure.status);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) {
    const raw = await res.text();
    let msg = raw?.trim() || `Falha no login (${res.status})`;
    try {
      const j = JSON.parse(raw) as { message?: string | string[] };
      if (Array.isArray(j.message)) msg = j.message.join(", ");
      else if (typeof j.message === "string" && j.message.trim()) msg = j.message.trim();
    } catch {
      /* */
    }
    throw new ApiError(msg, res.status);
  }
  const data = await parseJson<AuthLoginResponse & { user?: AuthLoginResponse["user"] }>(res);
  if (cookieMode) {
    if (!data?.user) throw new ApiError("Resposta de login inválida (esperado objeto user).", res.status);
    return { accessToken: "", refreshToken: "", user: data.user };
  }
  if (!data?.accessToken?.trim() || !data?.user) {
    throw new ApiError("Resposta de login inválida ou incompleta da API.", res.status);
  }
  return data as AuthLoginResponse;
}

/** Refresh JWT corporativo (motorista / Bearer). Staff cookie mode usa `/api/auth/refresh`. */
export async function authRefresh(
  refreshToken: string | null | undefined,
  opts?: { cookieMode?: boolean },
): Promise<Pick<AuthLoginResponse, "accessToken" | "refreshToken">> {
  const cookieMode = opts?.cookieMode ?? false;
  if (!cookieMode && (!refreshToken || refreshToken.length < 10)) {
    throw new ApiError("Sessão expirada", 401);
  }
  const devHeaders = typeof window !== "undefined" ? await getDeviceSecurityHeaders() : {};
  const res =
    cookieMode && typeof window !== "undefined"
      ? await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
          headers: {
            ...devHeaders,
            "X-RL-Auth-Cookie": "1",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(cookieMode && !refreshToken ? {} : { refreshToken }),
        })
      : await fetch(authUrl("refresh"), {
          method: "POST",
          headers: { ...devHeaders, "Content-Type": "application/json" },
          body: JSON.stringify(cookieMode && !refreshToken ? {} : { refreshToken }),
          credentials: "include",
        });
  if (!res.ok) {
    throw new ApiError("Sessão expirada", res.status);
  }
  if (cookieMode) {
    await parseJson<{ ok?: boolean }>(res);
    return { accessToken: "", refreshToken: "" };
  }
  return parseJson(res);
}

export type AuthHealthResponse = { ok: true; renewed: boolean };

/** Heartbeat staff: valida cookie HttpOnly e renova JWT silenciosamente quando necessário. */
export async function authCheckHealth(): Promise<AuthHealthResponse> {
  const devHeaders = typeof window !== "undefined" ? await getDeviceSecurityHeaders() : {};
  const res = await fetch("/api/auth/health", {
    method: "GET",
    credentials: "include",
    headers: {
      ...devHeaders,
      "X-RL-Auth-Cookie": "1",
      Accept: "application/json",
    },
  });
  if (res.status === 401) {
    throw new ApiError("Sessão expirada", 401);
  }
  if (!res.ok) {
    throw new ApiError(`Healthcheck falhou (${res.status})`, res.status);
  }
  return parseJson<AuthHealthResponse>(res);
}

/** Cliente de autenticação corporativa (staff / motorista). */
export const corporateAuthClient = {
  checkHealth: authCheckHealth,
  login: authLogin,
  refresh: authRefresh,
};
