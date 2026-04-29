import { Role } from '@prisma/client';

/** Permissões extras para GERENTE cujo e-mail está em `DATAHUB_TI_EMAILS` (papel TI/Dados sem migration). */
export const DATAHUB_TI_PIPELINE_PERMISSIONS: readonly string[] = [
  'datahub:lake:list',
  'datahub:lake:ingest',
  'datahub:etl:run',
  'datahub:quality:read',
  'datahub:quality:verify',
  'datahub:export:read',
  'datahub:obs:read',
];

function parseDatahubTiEmails(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Indica se o gerente pode operar Lake/ETL/Quality-POST (além de BI/DW de leitura). */
export function isGerenteDatahubTi(
  email: string | undefined,
  datahubTiEmailCsv: string | undefined,
): boolean {
  if (!email) return false;
  const allow = parseDatahubTiEmails(datahubTiEmailCsv);
  return allow.length > 0 && allow.includes(email.toLowerCase());
}

/** Permissões granulares mapeadas por papel (RBAC estendido). */
export const ROLE_PERMISSIONS: Record<Role, readonly string[]> = {
  [Role.ADMIN]: [
    'auth:sessao',
    'clientes:criar',
    'clientes:ler',
    'clientes:atualizar',
    'clientes:excluir',
    'solicitacoes:criar',
    'solicitacoes:ler',
    'solicitacoes:atualizar',
    'solicitacoes:excluir',
    'solicitacoes:portaria',
    'solicitacoes:gate',
    'solicitacoes:patio',
    'solicitacoes:saida',
    'faturamento:ler',
    'faturamento:criar',
    'nfse:emitir',
    'nfse:cancelar',
    'nfse:consultar',
    'boletos:registrar',
    'boletos:atualizar',
    'relatorios:operacional',
    'relatorios:financeiro',
    'dashboard:operacional',
    'dashboard:financeiro',
    'dashboard:financeiro_executivo',
    'dashboard:performance',
    'comercial:pricing',
    'users:criar',
    'auditoria:ler',
    'datahub:lake:list',
    'datahub:lake:ingest',
    'datahub:etl:run',
    'datahub:dw:read',
    'datahub:bi:read',
    'datahub:quality:read',
    'datahub:quality:verify',
    'datahub:export:read',
    'datahub:obs:read',
    'plataforma:tenant:write',
    'plataforma:tenant:read',
    'plataforma:api:write',
    'plataforma:marketplace:write',
    'plataforma:consumo:read',
    'plataforma:estatisticas:read',
    'plataforma:seguranca:read',
    'automacao:admin',
    'automacao:read',
    'automacao:toggle',
    'automacao:workflow:test',
    'automacao:rpa:run',
  ],
  [Role.GERENTE]: [
    'auth:sessao',
    'clientes:criar',
    'clientes:ler',
    'clientes:atualizar',
    'clientes:excluir',
    'solicitacoes:criar',
    'solicitacoes:ler',
    'solicitacoes:atualizar',
    'solicitacoes:excluir',
    'solicitacoes:portaria',
    'solicitacoes:gate',
    'solicitacoes:patio',
    'solicitacoes:saida',
    'faturamento:ler',
    'faturamento:criar',
    'nfse:emitir',
    'nfse:cancelar',
    'nfse:consultar',
    'boletos:registrar',
    'boletos:atualizar',
    'relatorios:operacional',
    'relatorios:financeiro',
    'dashboard:operacional',
    'dashboard:financeiro',
    'dashboard:financeiro_executivo',
    'dashboard:performance',
    'comercial:pricing',
    'auditoria:ler',
    /* Datahub Fase 17: gerente de negócio só consome BI + catálogo DW; pipeline via DATAHUB_TI_EMAILS. */
    'datahub:dw:read',
    'datahub:bi:read',
    'plataforma:tenant:read',
    'plataforma:consumo:read',
    'plataforma:estatisticas:read',
    'plataforma:seguranca:read',
    'automacao:read',
    'automacao:toggle',
    'automacao:workflow:test',
    'automacao:rpa:run',
  ],
  [Role.OPERADOR_PORTARIA]: [
    'auth:sessao',
    'clientes:ler',
    'solicitacoes:criar',
    'solicitacoes:ler',
    'solicitacoes:atualizar',
    'solicitacoes:portaria',
    'dashboard:operacional',
    'dashboard:performance',
    'automacao:read',
  ],
  [Role.OPERADOR_GATE]: [
    'auth:sessao',
    'clientes:ler',
    'solicitacoes:ler',
    'solicitacoes:atualizar',
    'solicitacoes:gate',
    'solicitacoes:saida',
    'dashboard:operacional',
    'dashboard:performance',
    'automacao:read',
  ],
  [Role.OPERADOR_PATIO]: [
    'auth:sessao',
    'clientes:ler',
    'solicitacoes:ler',
    'solicitacoes:patio',
    'dashboard:operacional',
    'dashboard:performance',
    'automacao:read',
  ],
  [Role.CLIENTE]: [
    'auth:sessao',
    'clientes:ler',
    'solicitacoes:ler',
    'faturamento:ler',
    'portal:solicitacao:aprovar',
  ],
};

export type PermissionsForRoleOptions = {
  email?: string;
  datahubTiEmailCsv?: string;
};

export function permissionsForRole(role: Role, opts?: PermissionsForRoleOptions): string[] {
  const base = [...ROLE_PERMISSIONS[role]];
  if (
    role === Role.GERENTE &&
    isGerenteDatahubTi(opts?.email, opts?.datahubTiEmailCsv)
  ) {
    return [...new Set([...base, ...DATAHUB_TI_PIPELINE_PERMISSIONS])];
  }
  return base;
}
