import { createHmac, timingSafeEqual } from 'crypto';

export const LOCAL_MEDIA_TTL_SEC = 3600;

function hmac(relativeKey: string, exp: string, secret: string): string {
  return createHmac('sha256', secret).update(`GET\n${relativeKey}\n${exp}`, 'utf8').digest('base64url');
}

export function signLocalMedia(
  relativeKey: string,
  secret: string,
  ttlSec = LOCAL_MEDIA_TTL_SEC,
  nowMs = Date.now(),
): { exp: string; sig: string } {
  const exp = String(Math.floor(nowMs / 1000) + ttlSec);
  return { exp, sig: hmac(relativeKey, exp, secret) };
}

export function appendSignedMediaQuery(url: string, relativeKey: string, secret: string): string {
  if (!secret) {
    throw new Error('Segredo de assinatura de mídia ausente (STORAGE_SIGNING_SECRET ou JWT_SECRET).');
  }
  const { exp, sig } = signLocalMedia(relativeKey, secret);
  const join = url.includes('?') ? '&' : '?';
  return `${url}${join}exp=${encodeURIComponent(exp)}&sig=${encodeURIComponent(sig)}`;
}

/**
 * Troca só o host da URL pré-assinada (MinIO interno → localhost, etc.).
 * Não copia o path de `publicBase` — isso geraria objeto público sem query S3.
 */
export function rewriteSignedUrlHost(signedUrl: string, publicBase?: string): string {
  if (!publicBase?.trim()) return signedUrl;
  try {
    const signed = new URL(signedUrl);
    const base = new URL(publicBase);
    signed.protocol = base.protocol;
    signed.host = base.host;
    return signed.toString();
  } catch {
    return signedUrl;
  }
}

export function verifyLocalMediaSignature(
  relativeKey: string,
  exp: string | undefined,
  sig: string | undefined,
  secret: string,
  nowMs = Date.now(),
): boolean {
  if (!relativeKey || !exp?.trim() || !sig?.trim() || !secret) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum * 1000 < nowMs) return false;
  const expected = hmac(relativeKey, String(expNum), secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig.trim());
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
