/** Normaliza telefone BR para E.164 (+55DDDNUMERO). Retorna null se inválido. */
export function normalizeWhatsappPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.startsWith('55') && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return `+${digits}`;
}

/** Mascara telefone para logs/auditoria (LGPD). */
export function maskPhoneE164(e164: string): string {
  const d = e164.replace(/\D/g, '');
  if (d.length < 6) return '***';
  return `+${d.slice(0, 2)}***${d.slice(-4)}`;
}
