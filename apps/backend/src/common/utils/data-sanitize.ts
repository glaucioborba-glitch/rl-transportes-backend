/** Normalização BR / operacional — entrada de usuário antes de persistir ou comparar. */

export function onlyDigits(raw: string): string {
  return String(raw).replace(/\D/g, '');
}

/** CPF 11 dígitos (completa com zeros à esquerda quando parcial, ex.: login). */
export function normalizeCpfDigits(raw: string): string {
  const d = onlyDigits(raw);
  return d.length > 11 ? d.slice(-11) : d.padStart(11, '0');
}

/** CNPJ 14 dígitos. */
export function normalizeCnpjDigits(raw: string): string {
  const d = onlyDigits(raw);
  return d.length > 14 ? d.slice(-14) : d.padStart(14, '0');
}

export function normalizePlate(raw: string): string {
  return String(raw).replace(/[\s-]/g, '').toUpperCase();
}

export function normalizeContainerIso(raw: string): string {
  return String(raw).replace(/\s/g, '').toUpperCase();
}

/** Comparação/persistência — apenas letras e dígitos (ignora máscara com hífen/espaço). */
export function stripContainerIsoCanonical(raw: string): string {
  return String(raw).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}
