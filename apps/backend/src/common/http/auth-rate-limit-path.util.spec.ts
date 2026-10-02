import { isAuthBruteForcePath } from './auth-rate-limit-path.util';

describe('isAuthBruteForcePath', () => {
  it('cobre login staff, portal e mobile v1', () => {
    expect(isAuthBruteForcePath('/auth/login')).toBe(true);
    expect(isAuthBruteForcePath('/auth/refresh')).toBe(true);
    expect(isAuthBruteForcePath('/portal/login')).toBe(true);
    expect(isAuthBruteForcePath('/portal/auth/validar-pessoa')).toBe(true);
    expect(isAuthBruteForcePath('/mobile/v1/auth')).toBe(true);
    expect(isAuthBruteForcePath('/mobile/v1/auth/refresh')).toBe(true);
  });

  it('não limita health nem APIs operacionais', () => {
    expect(isAuthBruteForcePath('/health')).toBe(false);
    expect(isAuthBruteForcePath('/v2/solicitacoes')).toBe(false);
    expect(isAuthBruteForcePath('/cliente/portal/solicitacoes')).toBe(false);
  });
});
