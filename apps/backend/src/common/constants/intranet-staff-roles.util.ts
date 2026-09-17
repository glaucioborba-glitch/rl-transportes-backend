import { Role } from '@prisma/client';

/** Perfis que autenticam na intranet operacional (POST /auth/login). SUPER_ADMIN usa /auth/super-admin/login. */
export const INTRANET_STAFF_ROLE_LIST = [
  Role.ADMIN,
  Role.GERENTE,
  Role.OPERADOR_PORTARIA,
  Role.OPERADOR_GATE,
  Role.OPERADOR_PATIO,
] as const;

const INTRANET_STAFF_ROLES = new Set<Role>(INTRANET_STAFF_ROLE_LIST);

export function canIntranetStaffLogin(role: Role): boolean {
  return INTRANET_STAFF_ROLES.has(role);
}

export function canSuperAdminLogin(role: Role): boolean {
  return role === Role.SUPER_ADMIN;
}

/** Gerente ou acima — autorização excepcional (editar/excluir RIC). */
const GERENTE_MINIMO = new Set<Role>([Role.SUPER_ADMIN, Role.ADMIN, Role.GERENTE]);

export function isGerenteMinimo(role: Role): boolean {
  return GERENTE_MINIMO.has(role);
}
