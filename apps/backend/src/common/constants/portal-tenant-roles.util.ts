import { Role } from '@prisma/client';

/** Titular PJ/PF do portal (faturamento e gestão de equipe). */
export function isPortalPrincipalRole(role: Role): boolean {
  return role === Role.CLIENTE || role === Role.ADMIN_CLIENTE;
}

/** Transportadora terceirizada convidada pelo tenant principal. */
export function isTransportadoraTerceiraRole(role: Role): boolean {
  return role === Role.TRANSPORTADORA_TERCEIRA;
}

/** Perfis que autenticam em POST /portal/login (papel CLIENTE). */
export function canPortalClienteLogin(role: Role): boolean {
  return isPortalPrincipalRole(role) || isTransportadoraTerceiraRole(role);
}

/** Bloqueia gestão de equipe e financeiro para transportadoras. */
export function isPortalPrincipalTenant(cx: { portalTenantRole?: Role | null }): boolean {
  if (!cx.portalTenantRole) return true;
  return isPortalPrincipalRole(cx.portalTenantRole);
}
