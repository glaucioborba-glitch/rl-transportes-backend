/** Normalização textual para comparar cidade/município (acentos). */
export function foldComparable(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase();
}

export function onlyDigits(s: string): string {
  return s.replace(/\D/g, '');
}
