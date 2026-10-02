import type { Role } from '@prisma/client';
import type { PessoaAutorizadaSession } from '../../pessoas-autorizadas/pessoa-autorizada.types';
import type { PermissoesPessoaSession } from '../../pessoas-permissoes/pessoa-permissoes.types';

/** Papel CX (IAM portal — sem migration Prisma). */
export type PortalPapel = 'CLIENTE' | 'FORNECEDOR' | 'PARCEIRO';

export type CxPortalRequestUser = {
  sub: string;
  email: string;
  cpfCnpj: string;
  portalPapel: PortalPapel | 'STAFF';
  /** Role Prisma do tenant portal (ADMIN_CLIENTE, TRANSPORTADORA_TERCEIRA, …). */
  portalTenantRole?: Role;
  /** Quando STAFF: papel Prisma. */
  staffRole?: Role;
  tenantId: string;
  clienteId?: string | null;
  tokenVersion: number;
  auth: 'portal' | 'staff';
  /** Sessão Redis (JWT portal/staff com sid). */
  sid?: string;
  /** Pessoa autorizada selecionada na sessão Redis (portal cliente). */
  pessoaAutorizada?: PessoaAutorizadaSession;
  /** RBAC operacional da pessoa selecionada. */
  permissoesPessoa?: PermissoesPessoaSession;
  /** Transportadora terceirizada vinculada (delegação B2B). */
  transportadoraId?: string | null;
};

export type PortalAccessTokenPayload = {
  sub: string;
  email: string;
  cpfCnpj: string;
  portalPapel: PortalPapel;
  tenantId: string;
  clienteId: string | null;
  tv: number;
  kind: 'portal';
  sid?: string;
};

export type PortalRefreshTokenPayload = {
  sub: string;
  tv: number;
  kind: 'portal_refresh';
  portalPapel: PortalPapel;
  tenantId: string;
  clienteId: string | null;
  sid?: string;
  fp?: string;
};
