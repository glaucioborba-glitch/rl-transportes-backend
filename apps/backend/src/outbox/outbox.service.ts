import { Injectable, Logger } from '@nestjs/common';
import { OutboxEvent, OutboxEventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const STALE_PROCESSING_MS = 5 * 60 * 1000;
const MAX_FAILED_RETRIES = 5;
const BASE_RETRY_MS = 60_000;
const MAX_RETRY_MS = 3_600_000;

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Backoff exponencial: 1m, 2m, 4m, 8m, 16m (teto 60m). */
  retryBackoffMs(attempts: number): number {
    const n = Math.max(1, attempts);
    return Math.min(MAX_RETRY_MS, BASE_RETRY_MS * 2 ** (n - 1));
  }

  isReadyForRetry(processedAt: Date | null, attempts: number): boolean {
    if (!processedAt) return true;
    const waitMs = this.retryBackoffMs(attempts);
    return processedAt.getTime() + waitMs <= Date.now();
  }

  enqueue(
    tx: Prisma.TransactionClient,
    data: {
      aggregateType: string;
      aggregateId: string;
      eventType: string;
      payload: Prisma.InputJsonValue;
    },
  ) {
    return tx.outboxEvent.create({ data: { ...data, status: OutboxEventStatus.PENDING } });
  }

  /** Enfileira fora de transação operacional (ex.: event listeners). */
  enqueueStandalone(data: {
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Prisma.InputJsonValue;
  }) {
    return this.prisma.outboxEvent.create({
      data: { ...data, status: OutboxEventStatus.PENDING },
    });
  }

  /**
   * Claim atômico com FOR UPDATE SKIP LOCKED — seguro para múltiplas instâncias Nest.
   */
  async claimPending(limit = 20): Promise<OutboxEvent[]> {
    const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);

    return this.prisma.$transaction(async (tx) => {
      await tx.outboxEvent.updateMany({
        where: {
          status: OutboxEventStatus.PROCESSING,
          createdAt: { lt: staleBefore },
        },
        data: { status: OutboxEventStatus.PENDING, errorText: 'Reclaim após PROCESSING stale' },
      });

      const candidates = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM outbox_events
        WHERE status = 'PENDING'::"OutboxEventStatus"
        ORDER BY created_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      `;

      if (!candidates.length) {
        const retry = await tx.outboxEvent.findMany({
          where: { status: OutboxEventStatus.FAILED },
          orderBy: { createdAt: 'asc' },
          take: Math.max(1, Math.floor(limit / 2)),
        });
        const retriable = retry.filter((r) => {
          const attempts = this.failedAttempts(r.errorText);
          return attempts < MAX_FAILED_RETRIES && this.isReadyForRetry(r.processedAt, attempts);
        });
        if (!retriable.length) return [];
        const ids = retriable.map((r) => r.id);
        await tx.outboxEvent.updateMany({
          where: { id: { in: ids } },
          data: { status: OutboxEventStatus.PENDING },
        });
        return tx.outboxEvent.findMany({
          where: { id: { in: ids } },
          orderBy: { createdAt: 'asc' },
        });
      }

      const ids = candidates.map((c) => c.id);
      await tx.outboxEvent.updateMany({
        where: { id: { in: ids }, status: OutboxEventStatus.PENDING },
        data: { status: OutboxEventStatus.PROCESSING },
      });

      return tx.outboxEvent.findMany({
        where: { id: { in: ids }, status: OutboxEventStatus.PROCESSING },
        orderBy: { createdAt: 'asc' },
      });
    });
  }

  private failedAttempts(errorText: string | null): number {
    if (!errorText) return 0;
    const m = /\[retry:(\d+)\]/.exec(errorText);
    return m ? parseInt(m[1], 10) : 1;
  }

  markProcessed(id: string) {
    return this.prisma.outboxEvent.update({
      where: { id },
      data: { status: OutboxEventStatus.PROCESSED, processedAt: new Date(), errorText: null },
    });
  }

  markFailed(id: string, errorText: string): Promise<number> {
    return this.prisma.outboxEvent.findUnique({ where: { id } }).then((row) => {
      const prev = this.failedAttempts(row?.errorText ?? null);
      const attempts = prev + 1;
      const tagged = `[retry:${attempts}] ${errorText}`.slice(0, 4000);
      return this.prisma.outboxEvent
        .update({
          where: { id },
          data: { status: OutboxEventStatus.FAILED, errorText: tagged, processedAt: new Date() },
        })
        .then(() => attempts);
    });
  }

  /** Legado — evitar uso direto; mantido para testes. */
  findPending(limit = 20) {
    this.logger.warn('OutboxService.findPending() deprecated — use claimPending()');
    return this.prisma.outboxEvent.findMany({
      where: { status: OutboxEventStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }
}
