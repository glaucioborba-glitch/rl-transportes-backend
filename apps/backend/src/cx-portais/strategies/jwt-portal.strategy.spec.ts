import { UnauthorizedException } from '@nestjs/common';
import { assertPortalClienteTokenPayload } from './jwt-portal.strategy';
import type { PortalAccessTokenPayload } from '../types/cx-portal.types';

describe('assertPortalClienteTokenPayload', () => {
  const base = (): PortalAccessTokenPayload => ({
    sub: 'u',
    email: 'a@b.com',
    cpfCnpj: '11000000000108',
    portalPapel: 'CLIENTE',
    tenantId: 'default',
    clienteId: 'cli-1',
    tv: 0,
    kind: 'portal',
  });

  it('aceita CLIENTE com clienteId e cpfCnpj', () => {
    expect(() => assertPortalClienteTokenPayload(base())).not.toThrow();
  });

  it('401 se cpfCnpj ausente ou só máscaras', () => {
    expect(() =>
      assertPortalClienteTokenPayload({ ...base(), cpfCnpj: '' }),
    ).toThrow(UnauthorizedException);
    expect(() =>
      assertPortalClienteTokenPayload({ ...base(), cpfCnpj: '  .. - ' }),
    ).toThrow(UnauthorizedException);
  });

  it('401 se clienteId só espaços', () => {
    expect(() =>
      assertPortalClienteTokenPayload({ ...base(), clienteId: '   ' }),
    ).toThrow(UnauthorizedException);
  });

  it('ignora FORNECEDOR', () => {
    expect(() =>
      assertPortalClienteTokenPayload({
        ...base(),
        portalPapel: 'FORNECEDOR',
        clienteId: null,
        cpfCnpj: '',
      }),
    ).not.toThrow();
  });
});
