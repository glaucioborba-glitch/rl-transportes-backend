import { Role } from '@prisma/client';
import { resolveRequestTenant } from './resolve-request-tenant.util';

describe('resolveRequestTenant', () => {
  it('usa tenant do JWT staff', () => {
    expect(resolveRequestTenant({ user: { tenantId: 'acme', role: Role.ADMIN } })).toEqual({
      tenantId: 'acme',
      role: Role.ADMIN,
    });
  });

  it('usa tenant do portal (cxUser) quando não há req.user', () => {
    expect(
      resolveRequestTenant({
        cxUser: { tenantId: 't2', portalPapel: 'CLIENTE' },
      }),
    ).toEqual({ tenantId: 't2', role: Role.CLIENTE });
  });

  it('não deixa o portal cair em default se o JWT tem tenant', () => {
    const r = resolveRequestTenant({
      user: undefined,
      cxUser: { tenantId: 'vinhedo', portalPapel: 'CLIENTE' },
    });
    expect(r.tenantId).not.toBe('default');
    expect(r.tenantId).toBe('vinhedo');
  });

  it('público sem auth usa default', () => {
    expect(resolveRequestTenant({})).toEqual({ tenantId: 'default', role: undefined });
  });

  it('tenant do JWT staff prevalece sobre cxUser', () => {
    expect(
      resolveRequestTenant({
        user: { tenantId: 'staff-t', role: Role.ADMIN },
        cxUser: { tenantId: 'portal-t', portalPapel: 'CLIENTE' },
      }),
    ).toEqual({ tenantId: 'staff-t', role: Role.ADMIN });
  });
});
