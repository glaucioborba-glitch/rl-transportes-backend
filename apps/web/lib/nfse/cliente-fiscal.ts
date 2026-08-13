/** Alinhado ao `CreateClienteDto` / `PortalRegisterDto` (Nest + Prisma). */

export const REGIME_TRIBUTARIO_OPTIONS = [
  { value: "MEI", label: "MEI" },
  { value: "SimplesNacional", label: "Simples Nacional" },
  { value: "LucroPresumido", label: "Lucro Presumido" },
  { value: "LucroReal", label: "Lucro Real" },
] as const;

export const BR_UF = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export function formatCepBr(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function formatCnae7(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 7);
}

export function formatPhoneBr(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function formatIbge7(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 7);
}
