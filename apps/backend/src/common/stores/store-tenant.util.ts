import { DEFAULT_TENANT_ID } from '../../tenant/tenant.constants';
import type { TenantContextService } from '../../tenant/tenant-context.service';

export function resolveStoreTenantId(tenantCtx: TenantContextService): string {
  return tenantCtx.getTenantId() ?? DEFAULT_TENANT_ID;
}

export { DEFAULT_TENANT_ID };
