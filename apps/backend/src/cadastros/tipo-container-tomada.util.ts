export function tipoRequerTomadaReefer(
  tipos: Array<{ codigo: string; tomadaReefer: boolean }>,
  tipoCodigo?: string | null,
): boolean {
  const key = (tipoCodigo ?? '').trim().toUpperCase();
  if (!key) return false;
  return tipos.some((t) => t.codigo.trim().toUpperCase() === key && t.tomadaReefer);
}
