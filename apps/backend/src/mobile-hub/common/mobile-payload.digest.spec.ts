import { digestBase64Payload } from '../../integracao-mobilidade/common/integracao-string.util';

describe('digestBase64Payload (mobile payloads)', () => {
  it('retorna hint ok para payload pequeno', () => {
    expect(digestBase64Payload('YQ==')).toEqual({ lengthChars: 4, hint: 'ok' });
  });

  it('sinaliza payload grande', () => {
    const huge = 'x'.repeat(25_000);
    const d = digestBase64Payload(huge);
    expect(d.lengthChars).toBe(25_000);
    expect(d.hint).toContain('gzip');
  });
});
