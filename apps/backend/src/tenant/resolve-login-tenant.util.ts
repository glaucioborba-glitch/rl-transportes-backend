import type { Request } from 'express';
import { DEFAULT_TENANT_ID } from './tenant.constants';

/** Extrai tenant do header `X-Tenant-Id` (case-insensitive). */
export function extractTenantIdFromRequest(req?: Request): string | undefined {
  if (!req) return undefined;
  const raw = req.headers['x-tenant-id'];
  const value = typeof raw === 'string' ? raw.trim() : Array.isArray(raw) ? raw[0]?.trim() : '';
  return value || undefined;
}

/**
 * Resolve tenant para login: body → header X-Tenant-Id → default.
 * Single-tenant legado continua funcionando com `default`.
 */
export function resolveLoginTenantId(opts: {
  bodyTenantId?: string | null;
  req?: Request;
}): string {
  const fromBody = opts.bodyTenantId?.trim();
  if (fromBody) return fromBody;
  const fromHeader = extractTenantIdFromRequest(opts.req);
  if (fromHeader) return fromHeader;
  return DEFAULT_TENANT_ID;
}
