/**
 * Valida placa no padrão Mercosul (LLLNLNN) ou formato antigo brasileiro (LLLNNNN).
 * Aceita com ou sem hífen.
 */
export function isValidPlacaMercosulOuAntiga(raw: string): boolean {
  const s = raw.replace(/[\s-]/g, '').toUpperCase();
  if (!s) return false;
  const mercosul = /^[A-Z]{3}\d[A-Z0-9]\d{2}$/;
  const antiga = /^[A-Z]{3}\d{4}$/;
  return mercosul.test(s) || antiga.test(s);
}

/**
 * Inclui variação LLLLnLnn usada em documentação / portaria (ex.: ABCD1D34, XYZW9A12).
 */
export function isValidPlacaMercosulExtended(raw: string): boolean {
  const s = raw.replace(/[\s-]/g, '').toUpperCase();
  if (!s) return false;
  if (isValidPlacaMercosulOuAntiga(raw)) return true;
  const quatroLetras = /^[A-Z]{4}\d[A-Z]\d{2}$/;
  return quatroLetras.test(s);
}
