import {
  appendSignedMediaQuery,
  rewriteSignedUrlHost,
  signLocalMedia,
  verifyLocalMediaSignature,
} from './signed-media-url.util';

describe('signed-media-url', () => {
  const secret = 'test-secret-media';
  const key = 's1/vist/foto.jpg';

  it('aceita assinatura válida e rejeita expirada ou adulterada', () => {
    const { exp, sig } = signLocalMedia(key, secret, 60, 1_700_000_000_000);
    expect(verifyLocalMediaSignature(key, exp, sig, secret, 1_700_000_000_000)).toBe(true);
    expect(verifyLocalMediaSignature(key, exp, 'tampered', secret, 1_700_000_000_000)).toBe(false);
    expect(verifyLocalMediaSignature(key, exp, sig, secret, 1_700_000_000_000 + 61_000)).toBe(false);
  });

  it('anexa exp e sig na URL local', () => {
    const url = appendSignedMediaQuery('http://localhost:3001/v2/gate/vistoria/media/s1%2Ffoto.jpg', 's1/foto.jpg', secret);
    expect(url).toMatch(/[?&]exp=\d+/);
    expect(url).toMatch(/[?&]sig=/);
  });

  it('recusa assinar sem segredo', () => {
    expect(() => appendSignedMediaQuery('http://localhost:3001/x', 'k', '')).toThrow(/Segredo/);
  });

  it('reescreve só o host da URL pré-assinada e preserva a query S3', () => {
    const signed =
      'http://minio:9000/rl-transportes/logistica/vistorias/a.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc';
    const out = rewriteSignedUrlHost(signed, 'http://localhost:9000/rl-transportes');
    expect(out.startsWith('http://localhost:9000/rl-transportes/logistica/vistorias/a.jpg?')).toBe(true);
    expect(out).toContain('X-Amz-Signature=abc');
    expect(out).not.toContain('minio:9000');
  });
});
