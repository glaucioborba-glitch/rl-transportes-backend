const PREFIX = "rl-rh";

export function rhUserOverridesKey(userId: string) {
  return `${PREFIX}:user-overrides:${userId}`;
}

export function rhPontoKey(userId: string) {
  return `${PREFIX}:ponto:${userId}`;
}

export function rhEscalaKey() {
  return `${PREFIX}:escala-semanal`;
}

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}
