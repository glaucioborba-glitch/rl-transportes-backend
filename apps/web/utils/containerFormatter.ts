const ISO_MAX_LEN = 11;

/** Remove formatação e limita a 11 caracteres alfanuméricos (ISO 6346). */
export function stripContainerISO(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, ISO_MAX_LEN);
}

/**
 * Formata número ISO 6346: AAAA 000000-0 (4 letras + 6 dígitos + dígito verificador).
 * Máscara progressiva enquanto o usuário digita.
 */
export function formatContainerISO(value: string): string {
  const raw = stripContainerISO(value);
  if (!raw) return "";

  const letters = raw.slice(0, 4).replace(/[^A-Z]/g, "");
  const digits = raw.slice(4).replace(/[^0-9]/g, "").slice(0, 7);

  if (letters.length < 4) return letters;
  if (!digits.length) return letters;

  const six = digits.slice(0, 6);
  const check = digits.slice(6, 7);

  if (!check) return `${letters} ${six}`;
  return `${letters} ${six}-${check}`;
}
