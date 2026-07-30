import { Prisma, PrismaClient } from '@prisma/client';
import type { AuditContextState } from './audit-context.service';
import {
  buildAuditNarrative,
  resolveAuditAcao,
  resolveAuditCategoria,
  sanitizeAuditPayload,
  type AuditCaptureInput,
} from './audit-trail-narrative.util';
import type { AuditedPrismaModel } from './audit-trail.models';

type ExtendedClient = PrismaClient;

export async function resolveContainerIso(
  client: ExtendedClient,
  model: AuditedPrismaModel,
  record: Record<string, unknown> | null,
): Promise<string | null> {
  if (!record) return null;

  if (model === 'PreFatura') {
    return (record.containerIso as string | undefined) ?? null;
  }

  if (model === 'Fatura') {
    const preFaturaId = record.preFaturaId as string | undefined;
    if (preFaturaId) {
      const pf = await client.preFatura.findUnique({
        where: { id: preFaturaId },
        select: { containerIso: true },
      });
      return pf?.containerIso ?? null;
    }
    return null;
  }

  if (model === 'Boleto' || model === 'NfsEmitida') {
    const faturamentoId = record.faturamentoId as string | undefined;
    if (!faturamentoId) return null;
    const link = await client.faturamentoSolicitacao.findFirst({
      where: { faturamentoId },
      select: { solicitacaoId: true },
    });
    if (!link?.solicitacaoId) return null;
    const unidade = await client.unidade.findFirst({
      where: { solicitacaoId: link.solicitacaoId },
      select: { numeroIso: true },
      orderBy: { createdAt: 'asc' },
    });
    return unidade?.numeroIso ?? null;
  }

  const solicitacaoId =
    model === 'Solicitacao'
      ? (record.id as string)
      : model === 'BloqueioContainer'
        ? (record.solicitacaoId as string | undefined)
        : undefined;

  if (!solicitacaoId) return null;

  const unidade = await client.unidade.findFirst({
    where: { solicitacaoId },
    select: { numeroIso: true },
    orderBy: { createdAt: 'asc' },
  });
  return unidade?.numeroIso ?? null;
}

export async function appendAuditTrailEntry(
  client: ExtendedClient,
  actor: AuditContextState,
  input: Omit<AuditCaptureInput, 'usuarioId' | 'usuarioNome' | 'usuarioRole' | 'tenantId' | 'ipAddress'>,
): Promise<void> {
  const full: AuditCaptureInput = {
    ...input,
    usuarioId: actor.usuarioId,
    usuarioNome: actor.usuarioNome,
    usuarioRole: actor.usuarioRole,
    tenantId: actor.tenantId,
    ipAddress: actor.ipAddress,
  };

  const descricaoNarrativa = buildAuditNarrative(full);

  await client.auditLog.create({
    data: {
      tenantId: full.tenantId,
      entidadeId: full.entidadeId,
      entidadeTipo: full.entidadeTipo,
      categoria: full.categoria,
      acao: full.acao,
      usuarioId: full.usuarioId,
      usuarioNome: full.usuarioNome,
      usuarioRole: full.usuarioRole,
      containerIso: full.containerIso ?? null,
      descricaoNarrativa,
      dadosAnteriores: sanitizeAuditPayload(full.dadosAnteriores) as Prisma.InputJsonValue | undefined,
      dadosNovos: sanitizeAuditPayload(full.dadosNovos) as Prisma.InputJsonValue | undefined,
      ipAddress: full.ipAddress ?? null,
    },
  });
}

export async function captureModelMutation(
  client: ExtendedClient,
  actor: AuditContextState,
  model: AuditedPrismaModel,
  operation: 'update' | 'delete',
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Promise<void> {
  const entidadeId = String((after ?? before)?.id ?? '');
  if (!entidadeId) return;

  const acao = resolveAuditAcao(model, operation, before, after);
  const categoria = resolveAuditCategoria(model, acao, after ?? before);
  const containerIso = await resolveContainerIso(client, model, after ?? before);

  await appendAuditTrailEntry(client, actor, {
    entidadeTipo: model.toUpperCase(),
    entidadeId,
    acao,
    categoria,
    containerIso,
    dadosAnteriores: before ?? undefined,
    dadosNovos: after ?? undefined,
  });
}
