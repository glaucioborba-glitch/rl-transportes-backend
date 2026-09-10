import { Injectable, Logger } from '@nestjs/common';
import { CategoriaAuditLog } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PortalNotificacaoService } from '../portal-notificacoes/portal-notificacao.service';
import { PrismaService } from '../prisma/prisma.service';

type UnidadeProcessoOutboxPayload = {
  unidadeProcessoId?: string;
  numero?: number;
  unidadeIso?: string;
  clienteId?: string;
  tenantId?: string;
  solicitacaoId?: string;
  saidaSolicitacaoId?: string;
  actorUserId?: string;
};

@Injectable()
export class UnidadeProcessoOutboxProcessor {
  private readonly logger = new Logger(UnidadeProcessoOutboxProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: PortalNotificacaoService,
    private readonly audit: AuditLogService,
  ) {}

  async process(eventType: 'UNIDADE_PROCESSO_ABERTO' | 'UNIDADE_PROCESSO_ENCERRADO', payload: unknown) {
    const p = (payload ?? {}) as UnidadeProcessoOutboxPayload;
    const processoId = p.unidadeProcessoId?.trim();
    if (!processoId) {
      this.logger.warn(`${eventType} sem unidadeProcessoId — ignorado`);
      return;
    }

    const row = await this.prisma.unidadeProcesso.findUnique({
      where: { id: processoId },
      select: {
        id: true,
        numero: true,
        unidadeIso: true,
        clienteId: true,
        tenantId: true,
        status: true,
        entradaSolicitacaoId: true,
        saidaSolicitacaoId: true,
      },
    });
    if (!row) {
      this.logger.warn(`${eventType} ${processoId} não encontrado`);
      return;
    }

    const aberto = eventType === 'UNIDADE_PROCESSO_ABERTO';
    await this.notificacoes.criarUnidadeProcesso({
      clienteId: row.clienteId,
      tenantId: row.tenantId,
      numero: row.numero,
      unidadeIso: row.unidadeIso,
      aberto,
    });

    await this.audit.append({
      entidadeId: row.id,
      entidadeTipo: 'UnidadeProcesso',
      categoria: CategoriaAuditLog.OPERACIONAL,
      acao: aberto ? 'UNIDADE_PROCESSO_ABERTO' : 'UNIDADE_PROCESSO_ENCERRADO',
      usuarioId: p.actorUserId ?? 'system',
      usuarioNome: 'sistema',
      usuarioRole: 'SYSTEM',
      containerIso: row.unidadeIso,
      descricaoNarrativa: aberto
        ? `ID ${row.numero} aberto para ${row.unidadeIso}`
        : `ID ${row.numero} encerrado para ${row.unidadeIso}`,
      tenantId: row.tenantId,
      dadosNovos: {
        numero: row.numero,
        status: row.status,
        solicitacaoId: aberto ? row.entradaSolicitacaoId : row.saidaSolicitacaoId,
      },
    });
  }
}
