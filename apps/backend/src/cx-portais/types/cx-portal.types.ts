import type { Role } from '@prisma/client';

/** Papel CX (IAM portal — sem migration Prisma). */
export type PortalPapel = 'CLIENTE' | 'FORNECEDOR' | 'PARCEIRO';

export type CxPortalRequestUser = {
  sub: string;
  email: string;
  portalPapel: PortalPapel | 'STAFF';
  /** Quando STAFF: papel Prisma. */
  staffRole?: Role;
  tenantId: string;
  clienteId?: string | null;
  tokenVersion: number;
  auth: 'portal' | 'staff';
};

export type PortalAccessTokenPayload = {
  sub: string;
  email: string;
  portalPapel: PortalPapel;
  tenantId: string;
  clienteId: string | null;
  tv: number;
  kind: 'portal';
};

export type PortalRefreshTokenPayload = {
  sub: string;
  tv: number;
  kind: 'portal_refresh';
  portalPapel: PortalPapel;
  tenantId: string;
  clienteId: string | null;
};
