import { Role } from '@prisma/client';

/** Perfis que autenticam na intranet (POST /auth/login). */
const INTRANET_STAFF_ROLES = new Set<Role>([
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.GERENTE,
  Role.OPERADOR_PORTARIA,
  Role.OPERADOR_GATE,
  Role.OPERADOR_PATIO,
]);

export function canIntranetStaffLogin(role: Role): boolean {
  return INTRANET_STAFF_ROLES.has(role);
}
