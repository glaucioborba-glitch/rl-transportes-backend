import { gerarCSRFToken, validarCSRFToken } from './csrftoken.util';

describe('csrftoken.util', () => {
  it('gerarCSRFToken produz string com entropia mínima', () => {
    const t = gerarCSRFToken();
    expect(t.length).toBeGreaterThan(20);
  });

  it('validarCSRFToken aceita par idêntico', () => {
    const t = gerarCSRFToken();
    expect(validarCSRFToken(t, t)).toBe(true);
  });

  it('validarCSRFToken rejeita header divergente', () => {
    const a = gerarCSRFToken();
    const b = gerarCSRFToken();
    expect(validarCSRFToken(a, b)).toBe(false);
  });
});
