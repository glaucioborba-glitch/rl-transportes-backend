/** Moedas e idiomas do tenant (Super Admin). Números sempre no padrão contábil pt-BR. */
export const MOEDAS_CORRENTES = [
  { codigo: "BRL", nome: "Real brasileiro", simbolo: "R$" },
  { codigo: "USD", nome: "Dólar americano", simbolo: "US$" },
  { codigo: "EUR", nome: "Euro", simbolo: "€" },
  { codigo: "PYG", nome: "Guarani paraguaio", simbolo: "₲" },
  { codigo: "ARS", nome: "Peso argentino", simbolo: "AR$" },
  { codigo: "CLP", nome: "Peso chileno", simbolo: "CLP$" },
  { codigo: "UYU", nome: "Peso uruguaio", simbolo: "$U" },
  { codigo: "PEN", nome: "Sol peruano", simbolo: "S/" },
  { codigo: "COP", nome: "Peso colombiano", simbolo: "COP$" },
] as const;

export const IDIOMAS_PADRAO = [
  { codigo: "pt-BR", nome: "Português (Brasil)" },
  { codigo: "es-ES", nome: "Español" },
  { codigo: "en-US", nome: "English" },
] as const;

export type MoedaCorrenteCodigo = (typeof MOEDAS_CORRENTES)[number]["codigo"];
export type IdiomaPadraoCodigo = (typeof IDIOMAS_PADRAO)[number]["codigo"];

export const MOEDA_PADRAO: MoedaCorrenteCodigo = "BRL";
export const IDIOMA_PADRAO: IdiomaPadraoCodigo = "pt-BR";

let moedaCorrente: MoedaCorrenteCodigo = MOEDA_PADRAO;
let idiomaPadrao: IdiomaPadraoCodigo = IDIOMA_PADRAO;

export function isMoedaCorrenteCodigo(v: unknown): v is MoedaCorrenteCodigo {
  return typeof v === "string" && MOEDAS_CORRENTES.some((m) => m.codigo === v);
}

export function isIdiomaPadraoCodigo(v: unknown): v is IdiomaPadraoCodigo {
  return typeof v === "string" && IDIOMAS_PADRAO.some((i) => i.codigo === v);
}

export function resolveMoeda(codigo?: string | null) {
  const code = isMoedaCorrenteCodigo(codigo) ? codigo : moedaCorrente;
  return MOEDAS_CORRENTES.find((m) => m.codigo === code) ?? MOEDAS_CORRENTES[0];
}

export function setMoedaCorrente(codigo?: string | null) {
  moedaCorrente = isMoedaCorrenteCodigo(codigo) ? codigo : MOEDA_PADRAO;
}

export function getMoedaCorrente(): MoedaCorrenteCodigo {
  return moedaCorrente;
}

export function setIdiomaPadrao(codigo?: string | null) {
  idiomaPadrao = isIdiomaPadraoCodigo(codigo) ? codigo : IDIOMA_PADRAO;
}

export function getIdiomaPadrao(): IdiomaPadraoCodigo {
  return idiomaPadrao;
}

export function labelMoeda(codigo?: string | null): string {
  const m = resolveMoeda(codigo);
  return `${m.simbolo} — ${m.nome} (${m.codigo})`;
}

export function labelIdioma(codigo?: string | null): string {
  const code = isIdiomaPadraoCodigo(codigo) ? codigo : idiomaPadrao;
  return IDIOMAS_PADRAO.find((i) => i.codigo === code)?.nome ?? IDIOMAS_PADRAO[0].nome;
}

export function simboloMoeda(codigo?: string | null): string {
  return resolveMoeda(codigo).simbolo;
}

/** Número contábil: 1.550,32 */
export function formatContabil(n: number): string {
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(n);
}

/** Moeda do sistema + número contábil: R$ 1.550,32 */
export function formatBRL(n: number, codigo?: string | null) {
  if (!Number.isFinite(n)) return "—";
  return `${simboloMoeda(codigo)} ${formatContabil(n)}`;
}

export function parseMoeda(raw: string | number | null | undefined): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : NaN;
  const t = String(raw ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/^[^\d-]+/, "");
  if (!t) return NaN;
  if (t.includes(",") && t.includes(".")) {
    return Number(t.replace(/\./g, "").replace(",", "."));
  }
  if (t.includes(",")) return Number(t.replace(",", "."));
  return Number(t);
}

export function parseDecimal(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseMoeda(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (v && typeof v === "object" && "toString" in v) {
    const n = parseMoeda(String(v));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function defaultRange90d() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 90);
  return { di: start.toISOString().slice(0, 10), df: end.toISOString().slice(0, 10) };
}
