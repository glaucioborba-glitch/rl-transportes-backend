import { resolveLoginTenantId } from './resolve-login-tenant.util';

describe('resolveLoginTenantId', () => {
  it('prioriza body sobre header', () => {
    const req = { headers: { 'x-tenant-id': 'header-tenant' } } as never;
    expect(resolveLoginTenantId({ bodyTenantId: 'body-tenant', req })).toBe('body-tenant');
  });

  it('usa header quando body ausente', () => {
    const req = { headers: { 'x-tenant-id': 'acme' } } as never;
    expect(resolveLoginTenantId({ req })).toBe('acme');
  });

  it('fallback default', () => {
    expect(resolveLoginTenantId({})).toBe('default');
  });
});
