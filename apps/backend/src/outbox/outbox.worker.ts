import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OutboxEventStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ClsService } from 'nestjs-cls';
import { AlertService } from '../alert/alert.service';
import { BillingOutboxProcessor } from './billing-outbox.processor';
import { OutboxService } from './outbox.service';
import { NfseBoletoOutboxProcessor } from './nfse-boleto-outbox.processor';
import { OUTBOX_WHATSAPP_NOTIFY } from '../notification/notification.constants';
import { WhatsappOutboxProcessor } from '../notification/whatsapp-outbox.processor';
import { TRACE_ID_KEY } from '../common/observability/trace.constants';
import { RealtimeEmitterService } from '../realtime/realtime-emitter.service';
import { RetriableOutboxError } from './outbox.errors';

const POLL_MS = 10_000;

@Injectable()
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private readonly outbox: OutboxService,
    private readonly billing: BillingOutboxProcessor,
    private readonly nfseBoleto: NfseBoletoOutboxProcessor,
    private readonly whatsappNotify: WhatsappOutboxProcessor,
    private readonly realtime: RealtimeEmitterService,
    private readonly cls: ClsService,
    private readonly alerts: AlertService,
  ) {}

  onModuleInit(): void {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), POLL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.running) return;

    await this.cls.run(async () => {
      const traceId = randomUUID();
      this.cls.set(TRACE_ID_KEY, traceId);
      this.logger.log(`Outbox worker tick started (traceId=${traceId})`);

      this.running = true;
      try {
        const events = await this.outbox.claimPending();
        for (const evt of events) {
          await this.processOne(evt.id, evt.eventType, evt.payload, evt.aggregateId, traceId);
        }
      } catch (err) {
        this.logger.error(`Outbox worker tick failed (traceId=${traceId})`, err);
      } finally {
        this.running = false;
      }
    });
  }

  private async processOne(
    id: string,
    eventType: string,
    payload: unknown,
    aggregateId: string,
    traceId: string,
  ): Promise<void> {
    try {
      if (eventType === 'BILLING_TRIGGERED') {
        await this.billing.processBillingTriggered(id, payload);
      } else if (eventType === 'EMITIR_NFSE_BOLETO') {
        await this.nfseBoleto.processEmitirNfseBoleto(id, payload);
      } else if (eventType === OUTBOX_WHATSAPP_NOTIFY) {
        await this.whatsappNotify.processWhatsappNotify(id, payload);
      } else {
        throw new Error(`Event type não suportado: ${eventType}`);
      }
      await this.outbox.markProcessed(id);
      this.realtime.emitDispatchUpdated({
        source: 'outbox',
        outboxId: id,
        eventType,
        aggregateId,
        status: OutboxEventStatus.PROCESSED,
        processedAt: new Date().toISOString(),
      });
      this.logger.log(`Outbox ${id} PROCESSED (traceId=${traceId})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const retriable = err instanceof RetriableOutboxError;
      this.logger.warn(
        `Outbox ${id} FAILED (traceId=${traceId})${retriable ? ' [retriável]' : ''}: ${msg}`,
      );
      const attempts = await this.outbox.markFailed(id, msg);
      if (eventType === 'EMITIR_NFSE_BOLETO' && attempts >= 3) {
        void this.alerts.outboxNfseConsecutiveFailures({
          outboxId: id,
          attempts,
          error: msg,
          traceId,
        });
      }
    }
  }
}
