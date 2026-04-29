import { randomBytes, timingSafeEqual } from 'crypto';

/** Gera token aleatório para double-submit CSRF. */
export function gerarCSRFToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Valida par cookie + header com comparação em tempo constante. */
export function validarCSRFToken(
  cookieVal: string | undefined,
  headerVal: string | string[] | undefined,
): boolean {
  const headerRaw = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  if (!cookieVal || !headerRaw || typeof headerRaw !== 'string') return false;
  try {
    const a = Buffer.from(cookieVal);
    const b = Buffer.from(headerRaw);
    if (a.length !== b.length || a.length < 16) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
