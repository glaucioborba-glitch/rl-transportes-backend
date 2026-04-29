const P = "rl-admin";

export const adminContractsKey = () => `${P}:contracts`;
export const adminLegalKey = () => `${P}:legal`;
export const adminDocsKey = () => `${P}:docs`;
export const adminServicosKey = () => `${P}:servicos`;
export const adminSlaInternoKey = () => `${P}:sla-interno`;

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
