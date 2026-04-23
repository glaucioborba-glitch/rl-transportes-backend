const MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/**
 * NTE-35/2021: caracteres proibidos no XML; & deve ser &amp; etc.
 */
export function escapeIpmNfseXmlValue(text: string): string {
  return text.replace(/[&<>"']/g, (c) => MAP[c] ?? c);
}
