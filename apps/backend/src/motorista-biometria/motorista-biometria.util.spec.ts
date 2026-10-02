import { isLikelyFirText, parseCpfBiometria } from './motorista-biometria.util';

describe('motorista-biometria.util', () => {
  it('aceita CPF com máscara', () => {
    expect(parseCpfBiometria('529.982.247-25')).toBe('52998224725');
  });

  it('rejeita CPF incompleto', () => {
    expect(parseCpfBiometria('5299822472')).toBeNull();
    expect(parseCpfBiometria('')).toBeNull();
  });

  it('rejeita canvas PNG como FIR', () => {
    expect(isLikelyFirText('data:image/png;base64,iVBORw0KGgo')).toBe(false);
    expect(isLikelyFirText('abc')).toBe(false);
    expect(isLikelyFirText('A'.repeat(40))).toBe(true);
  });
});
