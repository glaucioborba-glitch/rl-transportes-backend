import { MOTORISTA_SESSION_COOKIE } from "@/lib/motorista-signed-session";

/** Limpa leftover de cookie legado (`=1`) no browser. A sessão HMAC é HttpOnly (DELETE /api/motorista/session). */
export function clearMotoristaSessionCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${MOTORISTA_SESSION_COOKIE}=; path=/; max-age=0`;
}

export async function issueMotoristaSessionCookie(accessToken: string): Promise<boolean> {
  const res = await fetch("/api/motorista/session", {
    method: "POST",
    credentials: "include",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.ok;
}

export async function revokeMotoristaSessionCookie(): Promise<void> {
  try {
    await fetch("/api/motorista/session", { method: "DELETE", credentials: "include" });
  } catch {
    /* best-effort */
  }
  clearMotoristaSessionCookie();
}
