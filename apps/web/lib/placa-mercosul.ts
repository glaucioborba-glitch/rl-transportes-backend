/** Mesma regra do backend (`isValidPlacaMercosulExtended`): Mercosul, antiga ou 4 letras. */
export function isValidPlacaMercosul(raw: string): boolean {
  const s = raw.replace(/[\s-]/g, "").toUpperCase();
  if (!s) return false;
  const mercosul = /^[A-Z]{3}\d[A-Z0-9]\d{2}$/;
  const antiga = /^[A-Z]{3}\d{4}$/;
  const quatroLetras = /^[A-Z]{4}\d[A-Z]\d{2}$/;
  return mercosul.test(s) || antiga.test(s) || quatroLetras.test(s);
}
