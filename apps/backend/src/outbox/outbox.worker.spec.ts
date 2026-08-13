import { Test, TestingModule } from '@nestjs/testing';
import { OutboxEventStatus } from '@prisma/client';
import { OutboxWorker } from './outbox.worker';
import { OutboxService } from './outbox.service';
import { BillingOutboxProcessor } from './billing-outbox.processor';
import { NfseBoletoOutboxProcessor } from './nfse-boleto-outbox.processor';
import { WhatsappOutboxProcessor } from '../notification/whatsapp-outbox.processor';
import { RealtimeEmitterService } from '../realtime/realtime-emitter.service';
import { ClsService } from 'nestjs-cls';
import { AlertService } from '../alert/alert.service';

describe('OutboxWorker', () => {
  let worker: OutboxWorker;
  const outbox = {
    claimPending: jest.fn(),
    markProcessed: jest.fn(),
    markFailed: jest.fn(),
  };
  const billing = { processBillingTriggered: jest.fn() };
  const nfseBoleto = { processEmitirNfseBoleto: jest.fn() };
  const whatsappNotify = { processWhatsappNotify: jest.fn() };
  const realtime = { emitDispatchUpdated: jest.fn() };
  const cls = {
    run: jest.fn((fn: () => Promise<void>) => fn()),
    set: jest.fn(),
  };
  const alerts = {
    outboxNfseConsecutiveFailures: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxWorker,
        { provide: OutboxService, useValue: outbox },
        { provide: BillingOutboxProcessor, useValue: billing },
        { provide: NfseBoletoOutboxProcessor, useValue: nfseBoleto },
        { provide: WhatsappOutboxProcessor, useValue: whatsappNotify },
        { provide: RealtimeEmitterService, useValue: realtime },
        { provide: ClsService, useValue: cls },
        { provide: AlertService, useValue: alerts },
      ],
    }).compile();
    worker = module.get(OutboxWorker);
  });

  it('roteia BILLING_TRIGGERED para billing processor', async () => {
    outbox.claimPending.mockResolvedValue([
      {
        id: 'e1',
        eventType: 'BILLING_TRIGGERED',
        payload: { containerId: 'c1' },
        aggregateId: 'agg1',
      },
    ]);
    outbox.markProcessed.mockResolvedValue(undefined);

    await worker.tick();

    expect(billing.processBillingTriggered).toHaveBeenCalledWith('e1', { containerId: 'c1' });
    expect(outbox.markProcessed).toHaveBeenCalledWith('e1');
    expect(realtime.emitDispatchUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ status: OutboxEventStatus.PROCESSED }),
    );
  });

  it('marca FAILED em tipo desconhecido', async () => {
    outbox.claimPending.mockResolvedValue([
      {
        id: 'e2',
        eventType: 'UNKNOWN',
        payload: {},
        aggregateId: 'agg2',
      },
    ]);
    outbox.markFailed.mockResolvedValue(1);

    await worker.tick();

    expect(outbox.markFailed).toHaveBeenCalledWith('e2', expect.stringContaining('não suportado'));
  });
});
