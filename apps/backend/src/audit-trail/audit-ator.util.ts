import { Role } from '@prisma/client';
import { isTransportadoraTerceiraRole } from '../common/constants/portal-tenant-roles.util';
import { extractPessoaResponsavelFromAudit } from '../pessoas-autorizadas/pessoa-context.util';

export type AuditAtorTipo = 'cliente' | 'staff' | 'sistema';

export type AuditAtorUi = {
  tipo: AuditAtorTipo;
  empresaNome: string | null;
  operadorNome: string;
  papel: string;
};

const ROLES_CLIENTE = new Set<string>([
  Role.CLIENTE,
  Role.ADMIN_CLIENTE,
  Role.OPERADOR_INTERNO,
  Role.TRANSPORTADORA_TERCEIRA,
  'CLIENTE',
  'FORNECEDOR',
  'PARCEIRO',
]);

const ROLES_STAFF = new Set<string>([
  Role.ADMIN,
  Role.GERENTE,
  Role.SUPER_ADMIN,
  Role.OPERADOR_PORTARIA,
  Role.OPERADOR_GATE,
  Role.OPERADOR_PATIO,
]);

function unwrap(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  if (o.record && typeof o.record === 'object' && !Array.isArray(o.record)) {
    return { ...o, ...(o.record as Record<string, unknown>) };
  }
  return o;
}

function str(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length ? t : null;
}

export function isRoleClientePortal(role: string | null | undefined): boolean {
  if (!role) return false;
  return ROLES_CLIENTE.has(role) || isTransportadoraTerceiraRole(role as Role);
}

export function rotuloEmpresaCliente(c: {
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
} | null | undefined): string | null {
  if (!c) return null;
  return str(c.nomeFantasia) || str(c.razaoSocial);
}

export function resolveAuditAtor(input: {
  usuarioNome: string;
  usuarioRole: string;
  dadosNovos?: unknown;
  dadosAnteriores?: unknown;
  empresaNome?: string | null;
}): AuditAtorUi {
  const role = String(input.usuarioRole ?? '').trim();
  const payload = unwrap(input.dadosNovos) ?? unwrap(input.dadosAnteriores) ?? {};
  const ator = payload.ator && typeof payload.ator === 'object' ? (payload.ator as Record<string, unknown>) : {};
  const pessoa = extractPessoaResponsavelFromAudit(input.dadosNovos) ?? extractPessoaResponsavelFromAudit(input.dadosAnteriores);

  const empresaNome =
    str(input.empresaNome) ||
    str(ator.empresaNome) ||
    str(payload.empresaNome) ||
    null;

  const operadorNome =
    str(ator.operadorNome) ||
    str(pessoa?.nome) ||
    str(payload.operadorNome) ||
    str(input.usuarioNome) ||
    'Usuário';

  if (role === 'SISTEMA' || operadorNome.toLowerCase() === 'sistema') {
    return { tipo: 'sistema', empresaNome: null, operadorNome: 'Sistema', papel: 'SISTEMA' };
  }

  const portalHint = payload.portal === true || payload.tipo === 'PORTAL' || payload.origem === 'PORTAL';
  if (portalHint || isRoleClientePortal(role)) {
    return {
      tipo: 'cliente',
      empresaNome,
      operadorNome,
      papel: role || 'CLIENTE',
    };
  }

  if (ROLES_STAFF.has(role)) {
    return { tipo: 'staff', empresaNome: null, operadorNome, papel: role };
  }

  if (empresaNome) {
    return { tipo: 'cliente', empresaNome, operadorNome, papel: role || 'CLIENTE' };
  }

  return { tipo: 'staff', empresaNome: null, operadorNome, papel: role };
}

export function formatarAtorAuditoria(ator: AuditAtorUi): string {
  if (ator.tipo === 'sistema') return 'Sistema';
  if (ator.tipo === 'cliente') {
    if (ator.empresaNome) return `${ator.empresaNome} · ${ator.operadorNome}`;
    return `Cliente · ${ator.operadorNome}`;
  }
  return ator.operadorNome;
}
