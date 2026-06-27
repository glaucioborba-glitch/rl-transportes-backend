import { OutboxEventStatus } from '@prisma/client';
import { OutboxService } from './outbox.service';

describe('OutboxService', () => {
  it('markProcessed zera errorText', async () => {
    const prisma = {
      outboxEvent: {
        update: jest.fn().mockResolvedValue({ id: 'e1', status: OutboxEventStatus.PROCESSED }),
      },
    };
    const svc = new OutboxService(prisma as never);
    await svc.markProcessed('e1');
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'e1' },
        data: expect.objectContaining({ status: OutboxEventStatus.PROCESSED, errorText: null }),
      }),
    );
  });
});

describe('OutboxService retry backoff', () => {
  const svc = new OutboxService({} as never);

  it('aplica backoff exponencial crescente', () => {
    expect(svc.retryBackoffMs(1)).toBe(60_000);
    expect(svc.retryBackoffMs(2)).toBe(120_000);
    expect(svc.retryBackoffMs(3)).toBe(240_000);
    expect(svc.retryBackoffMs(10)).toBe(3_600_000);
  });

  it('isReadyForRetry respeita janela desde processedAt', () => {
    const now = Date.now();
    const recent = new Date(now - 30_000);
    expect(svc.isReadyForRetry(recent, 1)).toBe(false);
    const old = new Date(now - 120_000);
    expect(svc.isReadyForRetry(old, 1)).toBe(true);
  });
});
