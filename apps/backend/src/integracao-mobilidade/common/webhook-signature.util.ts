import * as crypto from 'crypto';

/** Assinatura HMAC-SHA256 (hex minúsculo) do payload bruto UTF-8. */
export function signWebhookPayload(secret: string, rawBody: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

export function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  signatureHex: string,
): boolean {
  const expected = signWebhookPayload(secret, rawBody).toLowerCase();
  const got = signatureHex.trim().toLowerCase();
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(got, 'hex');
  if (a.length !== b.length || a.length === 0) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
