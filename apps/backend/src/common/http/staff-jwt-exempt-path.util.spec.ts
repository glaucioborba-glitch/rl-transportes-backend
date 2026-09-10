import { isStaffJwtExemptPath, normalizeHttpPath } from './staff-jwt-exempt-path.util';

describe('isStaffJwtExemptPath', () => {
  it('libera health de load balancer e recusa diagnóstico', () => {
    expect(isStaffJwtExemptPath('/health')).toBe(true);
    expect(isStaffJwtExemptPath('/health/db')).toBe(true);
    expect(isStaffJwtExemptPath('/health/diagnostic')).toBe(false);
    expect(isStaffJwtExemptPath('/health/crons')).toBe(false);
  });

  it('não confunde /cliente (portal) com /clientes (staff)', () => {
    expect(isStaffJwtExemptPath('/cliente/portal/solicitacoes')).toBe(true);
    expect(isStaffJwtExemptPath('/clientes')).toBe(false);
  });

  it('libera login e mídia HMAC', () => {
    expect(isStaffJwtExemptPath('/auth/login')).toBe(true);
    expect(isStaffJwtExemptPath('/v2/gate/vistoria/media/s1/foto.jpg')).toBe(true);
    expect(isStaffJwtExemptPath('/v2/gate/vistoria/solicitacoes/abc')).toBe(false);
  });

  it('normaliza barra final', () => {
    expect(normalizeHttpPath('/health/')).toBe('/health');
  });

  it('libera timeline/pré-fatura do portal e PDF/QR v2 (auth própria)', () => {
    expect(isStaffJwtExemptPath('/client/container/ABCD1234567/timeline')).toBe(true);
    expect(isStaffJwtExemptPath('/client/container/ABCD1234567/pre-fatura')).toBe(true);
    expect(isStaffJwtExemptPath('/v2/solicitacoes/abc-uuid/pdf')).toBe(true);
    expect(isStaffJwtExemptPath('/v2/solicitacoes/abc-uuid/verificar')).toBe(true);
    expect(isStaffJwtExemptPath('/v2/solicitacoes')).toBe(false);
    expect(isStaffJwtExemptPath('/v2/solicitacoes/abc-uuid')).toBe(false);
  });
});
