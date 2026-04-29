export function formatBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

export function parseDecimal(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || 0;
  if (v && typeof v === "object" && "toString" in v) return Number(String(v)) || 0;
  return 0;
}

export function defaultRange90d() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 90);
  return { di: start.toISOString().slice(0, 10), df: end.toISOString().slice(0, 10) };
}
