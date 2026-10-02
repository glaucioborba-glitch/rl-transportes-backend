export const MOTORISTA_SESSION_COOKIE = "rl_motorista_session";
export const MOTORISTA_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;

const DEV_FALLBACK = "dev-motorista-session-do-not-use-in-prod";

function motoristaSessionSecret(): string {
  const s = (process.env.MOTORISTA_SESSION_SECRET || process.env.JWT_SECRET || "").trim();
  if (s) return s;
  if (process.env.NODE_ENV === "production") return "";
  return DEV_FALLBACK;
}

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** UUID ou id alfanumérico — evita payload HMAC com pontos extras. */
export function normalizeMotoristaUserId(raw: string | undefined | null): string | null {
  const t = (raw ?? "").trim();
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(t)) return null;
  return t;
}

/** Valor assinado `v1.<userId>.<exp>.<hmac>`. O cookie `=1` legado é rejeitado. */
export async function createMotoristaSessionValue(
  userId: string,
  nowMs = Date.now(),
): Promise<string | null> {
  const uid = normalizeMotoristaUserId(userId);
  const secret = motoristaSessionSecret();
  if (!uid || !secret) return null;
  const exp = Math.floor(nowMs / 1000) + MOTORISTA_SESSION_MAX_AGE_SEC;
  const payload = `v1.${uid}.${exp}`;
  const sig = await hmacHex(secret, payload);
  return `${payload}.${sig}`;
}

export async function isValidMotoristaSessionValue(value: string | undefined): Promise<boolean> {
  if (!value || value === "1") return false;
  const secret = motoristaSessionSecret();
  if (!secret) return false;
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return false;
  const uid = normalizeMotoristaUserId(parts[1]);
  const exp = Number(parts[2]);
  if (!uid || !Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const payload = `v1.${uid}.${parts[2]}`;
  const expected = await hmacHex(secret, payload);
  return timingSafeEqualHex(expected, parts[3]);
}
