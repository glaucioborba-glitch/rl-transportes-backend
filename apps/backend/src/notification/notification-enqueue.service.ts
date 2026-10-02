import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxEventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { type EstagioCobrancaNotificavel } from '../common/finance/regua-cobranca.util';
import {
  OUTBOX_WHATSAPP_NOTIFY,
  type WhatsappNotifyKind,
  type WhatsappNotifyPayload,
} from './notification.constants';

@Injectable()
export class NotificationEnqueueService {
  private readonly logger = new Logger(NotificationEnqueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  enqueueOperacionalInTx(
    tx: Prisma.TransactionClient,
    input: {
      kind: Extract<WhatsappNotifyKind, 'OPERACIONAL_GATE_IN' | 'OPERACIONAL_ARMAZENADO'>;
      solicitacaoId: string;
      containerIso: string;
      protocolo: string;
      eventAt: Date;
      dedupeKey: string;
    },
  ) {
    const payload: WhatsappNotifyPayload = {
      kind: input.kind,
      dedupeKey: input.dedupeKey,
      solicitacaoId: input.solicitacaoId,
      containerIso: input.containerIso,
      protocolo: input.protocolo,
      eventAt: input.eventAt.toISOString(),
    };

    return tx.outboxEvent.create({
      data: {
        aggregateType: 'Solicitacao',
        aggregateId: input.solicitacaoId,
        eventType: OUTBOX_WHATSAPP_NOTIFY,
        payload: payload as unknown as Prisma.InputJsonValue,
        status: OutboxEventStatus.PENDING,
      },
    });
  }

  async enqueueFinanceiroStandalone(input: {
    faturaId: string;
    clienteId: string;
    containerIso: string;
    valorTotal: number;
    dedupeKey: string;
  }) {
    const base = this.config.get<string>('whatsapp.portalPublicBaseUrl')?.replace(/\/$/, '') ?? '';
    const portalLink = `${base}/portal/financeiro`;

    const payload: WhatsappNotifyPayload = {
      kind: 'FINANCEIRO_FATURA',
      dedupeKey: input.dedupeKey,
      faturaId: input.faturaId,
      clienteId: input.clienteId,
      containerIso: input.containerIso,
      valorTotal: input.valorTotal,
      portalLink,
    };

    const row = await this.prisma.outboxEvent.create({
      data: {
        aggregateType: 'Fatura',
        aggregateId: input.faturaId,
        eventType: OUTBOX_WHATSAPP_NOTIFY,
        payload: payload as unknown as Prisma.InputJsonValue,
        status: OutboxEventStatus.PENDING,
      },
    });

    this.logger.log(`Outbox ${OUTBOX_WHATSAPP_NOTIFY} financeiro enfileirado — fatura ${input.faturaId}`);
    return row;
  }

  async enqueueDunningStandalone(input: {
    faturaId: string;
    clienteId: string;
    containerIso: string;
    valorExibicao: number;
    faturaNumero: string;
    portalLink: string;
    estagio: EstagioCobrancaNotificavel;
    dataVencimento: string;
    diasAtraso: number;
    dedupeKey: string;
    messagePreview?: string;
  }) {
    const payload: WhatsappNotifyPayload = {
      kind: 'DUNNING_COBRANCA',
      dedupeKey: input.dedupeKey,
      faturaId: input.faturaId,
      clienteId: input.clienteId,
      containerIso: input.containerIso,
      valorTotal: input.valorExibicao,
      portalLink: input.portalLink,
      dunningStage: input.estagio,
      faturaNumero: input.faturaNumero,
      dataVencimento: input.dataVencimento,
      diasAtraso: input.diasAtraso,
      messagePreview: input.messagePreview,
    };

    const row = await this.prisma.outboxEvent.create({
      data: {
        aggregateType: 'Fatura',
        aggregateId: input.faturaId,
        eventType: OUTBOX_WHATSAPP_NOTIFY,
        payload: payload as unknown as Prisma.InputJsonValue,
        status: OutboxEventStatus.PENDING,
      },
    });

    this.logger.log(
      `Outbox ${OUTBOX_WHATSAPP_NOTIFY} dunning ${input.estagio} — fatura ${input.faturaId}`,
    );
    return row;
  }
}
