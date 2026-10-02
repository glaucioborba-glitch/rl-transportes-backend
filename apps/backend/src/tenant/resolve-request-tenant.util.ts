import { Role } from '@prisma/client';
import { DEFAULT_TENANT_ID } from './tenant.constants';

export type TenantAwareRequest = {
  user?: { tenantId?: string | null; role?: Role };
  cxUser?: { tenantId?: string; staffRole?: Role; portalPapel?: string };
};

/**
 * Tenant do request autenticado.
 * Staff JWT → `user.tenantId`. Portal CX → `cxUser.tenantId` (JWT portal).
 * Não lê header `x-tenant-id` solto (evita tenant spoofing em rota pública).
 */
export function resolveRequestTenant(req: TenantAwareRequest): { tenantId: string; role?: Role } {
  const role = req.user?.role ?? req.cxUser?.staffRole ?? (req.cxUser ? Role.CLIENTE : undefined);
  const fromStaff = req.user?.tenantId?.trim();
  const fromPortal = req.cxUser?.tenantId?.trim();
  const tenantId = fromStaff || fromPortal || DEFAULT_TENANT_ID;
  return { tenantId, role };
}
