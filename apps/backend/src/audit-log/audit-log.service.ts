import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoriaAuditLog, Prisma, type AuditLog } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type { CxPortalRequestUser } from '../cx-portais/types/cx-portal.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  AUDIT_ACAO_UPDATE,
  AUDIT_ENTIDADE_SOLICITACAO,
  type AuditFieldDelta,
  type SolicitacaoAuditSnapshot,
} from './audit-log-solicitacao.util';

export type AppendAuditLogInput = {
  entidadeId: string;
  entidadeTipo?: string;
  acao?: string;
  categoria?: CategoriaAuditLog;
  containerIso?: string | null;
  descricaoNarrativa?: string;
  usuarioId: string;
  usuarioNome: string;
  usuarioRole: string;
  dadosAnteriores?: SolicitacaoAuditSnapshot | Record<string, unknown>;
  dadosNovos?: SolicitacaoAuditSnapshot | Record<string, unknown>;
  deltas?: AuditFieldDelta[];
  ipAddress?: string;
  tenantId?: string;
};

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Serviço append-only — expõe apenas create e leitura.
 * Não implementa update/delete (conformidade imutável).
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async append(input: AppendAuditLogInput, tx?: Prisma.TransactionClient): Promise<AuditLog> {
    const db = tx ?? this.prisma;
    const dadosNovos =
      input.dadosNovos || input.deltas?.length
        ? {
            ...(input.dadosNovos ?? {}),
            ...(input.deltas?.length ? { deltas: input.deltas } : {}),
          }
        : undefined;

    return db.auditLog.create({
      data: {
        tenantId: input.tenantId ?? 'default',
        entidadeId: input.entidadeId,
        entidadeTipo: input.entidadeTipo ?? AUDIT_ENTIDADE_SOLICITACAO,
        categoria: input.categoria ?? CategoriaAuditLog.SISTEMA,
        acao: input.acao ?? AUDIT_ACAO_UPDATE,
        usuarioId: input.usuarioId,
        usuarioNome: input.usuarioNome,
        usuarioRole: input.usuarioRole,
        containerIso: input.containerIso ?? null,
        descricaoNarrativa: input.descricaoNarrativa ?? '',
        dadosAnteriores: toJson(input.dadosAnteriores),
        dadosNovos: toJson(dadosNovos),
        ipAddress: input.ipAddress ?? null,
      },
    });
  }

  async appendSolicitacaoUpdate(
    solicitacaoId: string,
    actor: { usuarioId: string; usuarioNome: string; usuarioRole: string },
    before: SolicitacaoAuditSnapshot,
    after: SolicitacaoAuditSnapshot,
    deltas: AuditFieldDelta[],
    tx?: Prisma.TransactionClient,
  ): Promise<AuditLog | null> {
    if (!deltas.length) return null;
    return this.append(
      {
        entidadeId: solicitacaoId,
        entidadeTipo: AUDIT_ENTIDADE_SOLICITACAO,
        acao: AUDIT_ACAO_UPDATE,
        ...actor,
        dadosAnteriores: before,
        dadosNovos: after,
        deltas,
      },
      tx,
    );
  }

  private async assertSolicitacaoScope(
    solicitacaoId: string,
    cx?: CxPortalRequestUser,
    staff?: AuthUser,
  ): Promise<void> {
    const sol = await this.prisma.solicitacao.findFirst({
      where: { id: solicitacaoId, deletedAt: null },
      select: { id: true, clienteId: true },
    });
    if (!sol) throw new NotFoundException('Solicitação não encontrada');

    if (staff) return;

    if (cx) {
      if (cx.portalPapel === 'STAFF') return;
      if (cx.clienteId && cx.clienteId === sol.clienteId) return;
    }

    throw new ForbiddenException('Sem permissão para consultar o histórico desta solicitação.');
  }

  async listBySolicitacao(
    solicitacaoId: string,
    opts: { cx?: CxPortalRequestUser; staff?: AuthUser },
  ): Promise<AuditLog[]> {
    await this.assertSolicitacaoScope(solicitacaoId, opts.cx, opts.staff);
    return this.prisma.auditLog.findMany({
      where: {
        entidadeId: solicitacaoId,
        entidadeTipo: AUDIT_ENTIDADE_SOLICITACAO,
      },
      orderBy: { criadoEm: 'desc' },
      take: 200,
    });
  }

  /** Serializa entradas para consumo da UI (deltas legíveis, sem expor JSON bruto). */
  serializeForUi(logs: AuditLog[]) {
    return logs.map((log) => {
      const payload = (log.dadosNovos ?? log.dadosAnteriores) as
        | { deltas?: AuditFieldDelta[] }
        | null
        | undefined;
      const deltas = payload?.deltas ?? [];
      return {
        id: log.id,
        criadoEm: log.criadoEm.toISOString(),
        acao: log.acao,
        categoria: log.categoria,
        containerIso: log.containerIso,
        descricaoNarrativa: log.descricaoNarrativa,
        usuarioId: log.usuarioId,
        usuarioNome: log.usuarioNome,
        usuarioRole: log.usuarioRole,
        deltas,
      };
    });
  }
}
