import { mergeEmpresaOperadora } from '../tenant/empresa-operadora.types';

export const TENANT_BASE_ID = 'default';

export const TENANT_PLANOS = ['STANDARD', 'PREMIUM', 'ENTERPRISE'] as const;

export type TenantUso = {
  users: number;
  clientes: number;
  solicitacoes: number;
  faturas: number;
  unidadeProcessos: number;
};

export function motivoBloqueioExclusao(id: string, uso: TenantUso): string | null {
  if (id === TENANT_BASE_ID) return 'O terminal base (default) não pode ser excluído.';
  const partes: string[] = [];
  if (uso.users) partes.push(`${uso.users} usuário(s)`);
  if (uso.clientes) partes.push(`${uso.clientes} cliente(s)`);
  if (uso.solicitacoes) partes.push(`${uso.solicitacoes} solicitação(ões)`);
  if (uso.faturas) partes.push(`${uso.faturas} fatura(s)`);
  if (uso.unidadeProcessos) partes.push(`${uso.unidadeProcessos} ID(s) em pátio`);
  if (!partes.length) return null;
  return `Há dados neste terminal (${partes.join(', ')}). Bloqueie em vez de excluir.`;
}

export function podeAlterarStatusBase(id: string, status?: string): boolean {
  if (id !== TENANT_BASE_ID) return true;
  return !status || status === 'ATIVO';
}

export type EmpresaIdentidadePatch = {
  razaoSocial?: string;
  nomeFantasia?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  email?: string;
  telefone?: string;
};

export function digitsCnpj(raw?: string | null): string {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 14);
}

export function cnpjFromParametros(parametros: unknown): string {
  if (!parametros || typeof parametros !== 'object') return '';
  const emp = (parametros as { empresa?: { cnpj?: unknown } }).empresa;
  return digitsCnpj(emp?.cnpj != null ? String(emp.cnpj) : '');
}

function filled(v?: string): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

/** Grava CNPJ + dados da Receita em parametros.empresa (ficha Cadastros → Empresa). */
export function applyEmpresaIdentidade(
  parametros: unknown,
  opts: { cnpj?: string; nomeFallback?: string; empresa?: EmpresaIdentidadePatch },
): Record<string, unknown> {
  const base =
    parametros && typeof parametros === 'object' ? { ...(parametros as Record<string, unknown>) } : {};
  const atual = mergeEmpresaOperadora(base.empresa, opts.nomeFallback ?? '');
  const p = opts.empresa ?? {};
  const next = {
    ...atual,
    cnpj: opts.cnpj !== undefined ? digitsCnpj(opts.cnpj) : atual.cnpj,
    razaoSocial: filled(p.razaoSocial) || atual.razaoSocial,
    nomeFantasia: filled(p.nomeFantasia) || atual.nomeFantasia,
    cep: filled(p.cep) ?? atual.cep,
    logradouro: filled(p.logradouro) || atual.logradouro,
    numero: filled(p.numero) || atual.numero,
    bairro: filled(p.bairro) || atual.bairro,
    cidade: filled(p.cidade) || atual.cidade,
    uf: filled(p.uf)?.slice(0, 2).toUpperCase() || atual.uf,
    email: filled(p.email) || atual.email,
    telefone: filled(p.telefone) || atual.telefone,
  };
  if (opts.nomeFallback && !next.razaoSocial) next.razaoSocial = opts.nomeFallback;
  if (opts.nomeFallback && !next.nomeFantasia) next.nomeFantasia = opts.nomeFallback;
  base.empresa = next;
  return base;
}
