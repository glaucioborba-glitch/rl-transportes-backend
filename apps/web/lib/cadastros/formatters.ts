/** Formata CNPJ: 00000000000000 → 00.000.000/0000-00 */
export function formatCNPJ(value: string): string {
  const clean = (value || "").replace(/\D/g, "");
  if (clean.length !== 14) return value || "";
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

/** Formata CEP: 00000000 → 00000-000 */
export function formatCEP(value: string): string {
  const clean = (value || "").replace(/\D/g, "");
  if (clean.length !== 8) return value || "";
  return clean.replace(/^(\d{5})(\d{3})$/, "$1-$2");
}

/** Formata telefone: 0000000000 → (00) 0000-0000 ou (00) 00000-0000 */
export function formatPhone(value: string): string {
  const clean = (value || "").replace(/\D/g, "");
  if (clean.length === 11) {
    return clean.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  }
  if (clean.length === 10) {
    return clean.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  }
  return value || "";
}

export { validarCNPJ as isValidCNPJ, validarCPF as isValidCPF } from "@/lib/br-documents";

/** Formata CPF: 00000000000 → 000.000.000-00 */
export function formatCPF(value: string): string {
  const clean = (value || "").replace(/\D/g, "");
  if (clean.length !== 11) return value || "";
  return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

/** Formata PIS: 00000000000 → 000.00000.00-0 */
export function formatPIS(value: string): string {
  const clean = (value || "").replace(/\D/g, "");
  if (clean.length !== 11) return value || "";
  return clean.replace(/^(\d{3})(\d{5})(\d{2})(\d{1})$/, "$1.$2.$3-$4");
}

/** Valida PIS/PASEP usando algoritmo módulo 11 */
export function isValidPIS(pis: string): boolean {
  const clean = pis.replace(/\D/g, "");
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  const weights = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * weights[i];
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  return digit === parseInt(clean.charAt(10), 10);
}

/** Formata data ISO para DD/MM/YYYY */
export function formatDate(isoDate: string): string {
  if (!isoDate) return "";
  const date = new Date(isoDate.includes("T") ? isoDate : `${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("pt-BR");
}

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Retorna o número de dias até uma data (negativo se já passou) */
export function daysUntil(isoDate: string): number {
  if (!isoDate) return Infinity;
  const target = new Date(isoDate.includes("T") ? isoDate : `${isoDate}T12:00:00`);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

export { formatContainerNumber } from "@/components/ui/container-number";
export { stripContainerISO } from "@/utils/containerFormatter";

/** Validação ISO 6346 (dígito verificador) */
export function isValidISO6346(numero: string): boolean {
  const clean = numero.replace(/[\s-]/g, "").toUpperCase();
  if (clean.length !== 11) return false;

  const letters = clean.substring(0, 4);
  const numbers = clean.substring(4, 10);
  const checkDigit = parseInt(clean.substring(10, 11), 10);

  if (!/^[A-Z]{4}$/.test(letters)) return false;
  if (!/^\d{6}$/.test(numbers)) return false;

  const letterValues: Record<string, number> = {};
  let value = 10;
  for (let i = 0; i < 26; i++) {
    const char = String.fromCharCode(65 + i);
    if (value % 11 === 0) value++;
    letterValues[char] = value;
    value++;
  }

  const allChars = letters + numbers;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const char = allChars[i];
    const num = char >= "0" && char <= "9" ? parseInt(char, 10) : letterValues[char];
    sum += num * Math.pow(2, i);
  }

  const calculated = sum % 11;
  const finalDigit = calculated === 10 ? 0 : calculated;
  return finalDigit === checkDigit;
}
