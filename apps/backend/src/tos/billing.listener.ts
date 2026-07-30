import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OutboxEventStatus } from '@prisma/client';
import { isBillingEligibleIntent } from '../billing-engine/billing-eligible-intents.util';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CONTAINER_DISPATCHED_EVENT,
  type ContainerDispatchedPayload,
} from './container-lifecycle.service';
import { TosEventEmitter } from './tos-event-emitter';
import {
  TRANSPORTE_SOLICITADO_EVENT,
  type TransporteSolicitadoPayload,
} from '../agendamentos/agendamento-transporte.util';

@Injectable()
export class BillingListener implements OnModuleInit {
  private readonly logger = new Logger(BillingListener.name);

  constructor(
    private readonly eventEmitter: TosEventEmitter,
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  onModuleInit(): void {
    this.eventEmitter.on(TRANSPORTE_SOLICITADO_EVENT, (payload: TransporteSolicitadoPayload) => {
      this.logger.log(
        `[DESPACHO FL] Transporte solicitado — ${payload.numeroIso} ${payload.tipoOperacao} (${payload.localOrigem ?? payload.localDestino ?? 'N/A'})`,
      );
    });

    this.eventEmitter.on(CONTAINER_DISPATCHED_EVENT, (raw: unknown) => {
      void this.enqueueBillingIfNeeded(raw as ContainerDispatchedPayload);
    });
  }

  /** Gate-out concluído — enfileira BILLING_TRIGGERED para todos os intents elegíveis. */
  private async enqueueBillingIfNeeded(payload: ContainerDispatchedPayload): Promise<void> {
    if (!payload?.containerId || !payload?.clienteId) return;

    const existing = await this.prisma.outboxEvent.findFirst({
      where: {
        aggregateType: 'Container',
        aggregateId: payload.containerId,
        eventType: 'BILLING_TRIGGERED',
        status: { in: [OutboxEventStatus.PENDING, OutboxEventStatus.PROCESSING, OutboxEventStatus.PROCESSED] },
      },
      select: { id: true },
    });
    if (existing) {
      this.logger.debug(
        `BILLING_TRIGGERED já enfileirado para container ${payload.containerId} — skip listener`,
      );
      return;
    }

    let tipoOperacao: string | null = null;
    if (payload.solicitacaoId) {
      const sol = await this.prisma.solicitacao.findUnique({
        where: { id: payload.solicitacaoId },
        select: { tipoOperacao: true },
      });
      tipoOperacao = sol?.tipoOperacao ?? null;
      if (tipoOperacao && !isBillingEligibleIntent(sol!.tipoOperacao)) {
        this.logger.log(
          `Intent ${tipoOperacao} não elegível — billing omitido (container ${payload.numero})`,
        );
        return;
      }
    }

    await this.outbox.enqueueStandalone({
      aggregateType: 'Container',
      aggregateId: payload.containerId,
      eventType: 'BILLING_TRIGGERED',
      payload: {
        ...payload,
        gateInAt: payload.gateInAt.toISOString(),
        gateOutAt: payload.gateOutAt.toISOString(),
        tipoOperacao,
      },
    });

    this.logger.log(
      `BILLING_TRIGGERED enfileirado via listener — container ${payload.numero} (solicitação ${payload.solicitacaoId ?? 'N/A'})`,
    );
  }
}
