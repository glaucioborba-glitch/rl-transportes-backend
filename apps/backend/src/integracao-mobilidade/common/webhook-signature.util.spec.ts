import { signWebhookPayload, verifyWebhookSignature } from './webhook-signature.util';

describe('webhook-signature.util', () => {
  it('assinatura HMAC-SHA256 hex valida', () => {
    const secret = 'segredo-minimo-16-chars';
    const body = '{"a":1}';
    const sig = signWebhookPayload(secret, body);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyWebhookSignature(secret, body, sig)).toBe(true);
    expect(verifyWebhookSignature(secret, body, 'deadbeef')).toBe(false);
  });
});
