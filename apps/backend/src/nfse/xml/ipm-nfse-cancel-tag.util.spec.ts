import { assertCancelTagIpmUsavel, sanitizeIpmNfseCancelTag } from './ipm-nfse-cancel-tag.util';

describe('ipm-nfse-cancel-tag.util', () => {
  it('sanitiza e usa "tipo" por defeito', () => {
    expect(sanitizeIpmNfseCancelTag()).toBe('tipo');
    expect(sanitizeIpmNfseCancelTag('  tipo_1  ')).toBe('tipo_1');
  });

  it('rejeita tag vazia após remover caracteres inválidos', () => {
    expect(sanitizeIpmNfseCancelTag('###')).toBe('tipo');
  });

  it('assertCancelTagIpmUsavel valida padrão XML de nome de elemento', () => {
    expect(() => assertCancelTagIpmUsavel('tipo')).not.toThrow();
    expect(() => assertCancelTagIpmUsavel('1bad')).toThrow();
  });
});
