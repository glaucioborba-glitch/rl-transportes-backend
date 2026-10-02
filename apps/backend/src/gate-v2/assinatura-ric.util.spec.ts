import { ASSINATURA_BIOMETRIA_OK, isAssinaturaBiometria } from './assinatura-ric.util';

describe('assinatura-ric.util', () => {
  it('reconhece o marcador de digital verificada', () => {
    expect(isAssinaturaBiometria(ASSINATURA_BIOMETRIA_OK)).toBe(true);
    expect(isAssinaturaBiometria(` ${ASSINATURA_BIOMETRIA_OK} `)).toBe(true);
  });

  it('não trata canvas ou vazio como digital', () => {
    expect(isAssinaturaBiometria('')).toBe(false);
    expect(isAssinaturaBiometria(null)).toBe(false);
    expect(isAssinaturaBiometria('data:image/png;base64,aaa')).toBe(false);
  });
});
