/**
 * Valida placa no padrão Mercosul (LLLNLNN) ou formato antigo brasileiro (LLLNNNN).
 * Aceita com ou sem hífen.
 */
export function isValidPlacaMercosulOuAntiga(raw: string): boolean {
  const s = raw.replace(/\s/g, '').toUpperCase();
  if (!s) return false;
  const mercosul = /^[A-Z]{3}\d[A-Z0-9]\d{2}$/;
  const antiga = /^[A-Z]{3}\d{4}$/;
  const comHifenMercosul = /^[A-Z]{3}-\d[A-Z0-9]\d{2}$/;
  const comHifenAntiga = /^[A-Z]{3}-\d{4}$/;
  return (
    mercosul.test(s) ||
    antiga.test(s) ||
    comHifenMercosul.test(s) ||
    comHifenAntiga.test(s)
  );
}
