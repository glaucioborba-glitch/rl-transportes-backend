import { AUTH_SA_TENANT_COOKIE } from '../auth/auth-cookie.constants';
import {
  isSuperAdminConsolePath,
  parseSaActingTenantId,
  readSaActingTenantCookie,
} from './sa-acting-tenant.util';

describe('sa-acting-tenant.util', () => {
  it('aceita slug de tenant', () => {
    expect(parseSaActingTenantId('default')).toBe('default');
    expect(parseSaActingTenantId('terminal-xpto')).toBe('terminal-xpto');
  });

  it('recusa valor solto ou header forjado', () => {
    expect(parseSaActingTenantId('default; Path=/')).toBeNull();
    expect(parseSaActingTenantId('../x')).toBeNull();
    expect(parseSaActingTenantId('')).toBeNull();
    expect(parseSaActingTenantId(undefined)).toBeNull();
  });

  it('lê só o cookie HttpOnly do dono', () => {
    expect(readSaActingTenantCookie({ [AUTH_SA_TENANT_COOKIE]: 'acme' })).toBe('acme');
    expect(readSaActingTenantCookie({ 'x-tenant-id': 'acme' })).toBeNull();
  });

  it('reconhece o cockpit SaaS', () => {
    expect(isSuperAdminConsolePath('/super-admin')).toBe(true);
    expect(isSuperAdminConsolePath('/super-admin/tenants')).toBe(true);
    expect(isSuperAdminConsolePath('/operador/gate')).toBe(false);
    expect(isSuperAdminConsolePath('/auth/me')).toBe(false);
  });
});
