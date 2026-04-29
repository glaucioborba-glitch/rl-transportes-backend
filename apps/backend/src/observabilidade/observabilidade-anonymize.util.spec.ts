import {
  classificarOrigemPorRota,
  maskEmail,
  normalizarRotaMetricas,
} from './observabilidade-anonymize.util';

describe('observabilidade-anonymize.util', () => {
  it('maskEmail mascara usuario', () => {
    expect(maskEmail('joao.silva@empresa.com')).toContain('@empresa.com');
    expect(maskEmail('joao.silva@empresa.com')).toMatch(/\*\*\*/);
  });

  it('classificarOrigemPorRota cobre dominios principais', () => {
    expect(classificarOrigemPorRota('/auth/login')).toBe('auth');
    expect(classificarOrigemPorRota('/mobile/x')).toBe('mobile');
    expect(classificarOrigemPorRota('/solicitacoes')).toBe('operacional');
    expect(classificarOrigemPorRota('/observabilidade/logs')).toBe('observabilidade');
  });

  it('normalizarRotaMetricas substitui uuid por :id', () => {
    const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    expect(normalizarRotaMetricas(`/x/${id}/y`)).toBe('/x/:id/y');
  });
});
