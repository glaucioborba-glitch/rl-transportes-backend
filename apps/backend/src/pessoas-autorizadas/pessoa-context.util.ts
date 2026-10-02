import type { Request } from 'express';
import type { CxPortalRequestUser } from '../cx-portais/types/cx-portal.types';
import type { PessoaAuditMeta, PessoaAutorizadaSession } from './pessoa-autorizada.types';

export function buildPessoaAuditMeta(
  cx: CxPortalRequestUser,
  req?: Request,
  permissaoUsada?: string,
): (PessoaAuditMeta & {
  ip?: string | null;
  ua?: string | null;
  fingerprint?: string | null;
  permissaoUsada?: string;
}) | null {
  const pessoa = cx.pessoaAutorizada;
  if (!pessoa) return null;
  const cnpj = cx.cpfCnpj.replace(/\D/g, '');
  return {
    cnpj,
    pessoaId: pessoa.id,
    nome: pessoa.nome,
    email: pessoa.email,
    telefone: pessoa.telefone,
    ...(permissaoUsada ? { permissaoUsada } : {}),
    ip: req?.ip ?? req?.socket?.remoteAddress ?? null,
    ua: req?.get?.('user-agent') ?? null,
    fingerprint:
      (req?.headers?.['x-device-fingerprint'] as string | undefined)?.trim() ||
      (req?.headers?.['x-client-fingerprint'] as string | undefined)?.trim() ||
      null,
  };
}

export function toPessoaSession(row: {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
}): PessoaAutorizadaSession {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email.trim().toLowerCase(),
    telefone: row.telefone?.replace(/\D/g, '') || null,
  };
}

export function extractPessoaResponsavelFromAudit(dadosDepois: unknown): PessoaAutorizadaSession | null {
  if (!dadosDepois || typeof dadosDepois !== 'object') return null;
  const root = dadosDepois as Record<string, unknown>;
  const record =
    root.record && typeof root.record === 'object' && !Array.isArray(root.record)
      ? (root.record as Record<string, unknown>)
      : root;
  const pessoa = record.pessoaResponsavel;
  if (!pessoa || typeof pessoa !== 'object' || Array.isArray(pessoa)) return null;
  const p = pessoa as Record<string, unknown>;
  if (typeof p.id !== 'string' || typeof p.nome !== 'string' || typeof p.email !== 'string') return null;
  return {
    id: p.id,
    nome: p.nome,
    email: p.email,
    telefone: typeof p.telefone === 'string' ? p.telefone : null,
  };
}
