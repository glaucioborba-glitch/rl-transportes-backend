import { Role } from '@prisma/client';

/** Permissões granulares mapeadas por papel (RBAC estendido). */
export const ROLE_PERMISSIONS: Record<Role, readonly string[]> = {
  [Role.ADMIN]: [
    'clientes:criar',
    'clientes:ler',
    'clientes:atualizar',
    'clientes:excluir',
    'solicitacoes:criar',
    'solicitacoes:ler',
    'solicitacoes:atualizar',
    'solicitacoes:excluir',
    'solicitacoes:portaria',
    'users:criar',
  ],
  [Role.GERENTE]: [
    'clientes:criar',
    'clientes:ler',
    'clientes:atualizar',
    'clientes:excluir',
    'solicitacoes:criar',
    'solicitacoes:ler',
    'solicitacoes:atualizar',
    'solicitacoes:excluir',
    'solicitacoes:portaria',
  ],
  [Role.OPERADOR_PORTARIA]: [
    'clientes:ler',
    'solicitacoes:criar',
    'solicitacoes:ler',
    'solicitacoes:atualizar',
    'solicitacoes:portaria',
  ],
  [Role.OPERADOR_GATE]: [
    'clientes:ler',
    'solicitacoes:ler',
    'solicitacoes:atualizar',
  ],
  [Role.OPERADOR_PATIO]: ['clientes:ler', 'solicitacoes:ler'],
  [Role.CLIENTE]: ['clientes:ler', 'solicitacoes:ler'],
};

export function permissionsForRole(role: Role): string[] {
  return [...ROLE_PERMISSIONS[role]];
}
