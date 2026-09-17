import { Role } from '@prisma/client';
import { TenantContextService } from './tenant-context.service';

describe('TenantContextService.setFromAuth', () => {
  const svc = new TenantContextService();

  it('SUPER_ADMIN no cockpit faz bypass (vê todos os terminais)', () => {
    expect(svc.setFromAuth(Role.SUPER_ADMIN, 'default')).toEqual({
      tenantId: 'default',
      bypassIsolation: true,
    });
  });

  it('SUPER_ADMIN na intranet de um tenant isola os dados', () => {
    expect(svc.setFromAuth(Role.SUPER_ADMIN, 'acme', { acting: true })).toEqual({
      tenantId: 'acme',
      bypassIsolation: false,
    });
  });

  it('ADMIN nunca faz bypass', () => {
    expect(svc.setFromAuth(Role.ADMIN, 'acme')).toEqual({
      tenantId: 'acme',
      bypassIsolation: false,
    });
  });
});
