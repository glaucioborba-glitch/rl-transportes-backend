import { Test, TestingModule } from '@nestjs/testing';
import { OutboxEventStatus } from '@prisma/client';
import { OutboxWorker } from './outbox.worker';
import { OutboxService } from './outbox.service';
import { NfseBoletoOutboxProcessor } from './nfse-boleto-outbox.processor';
import { WhatsappOutboxProcessor } from '../notification/whatsapp-outbox.processor';
import { RealtimeEmitterService } from '../realtime/realtime-emitter.service';
import { ClsService } from 'nestjs-cls';
import { AlertService } from '../alert/alert.service';
import { UnidadeProcessoOutboxProcessor } from '../unidade-processo/unidade-processo-outbox.processor';

describe('OutboxWorker', () => {
  let worker: OutboxWorker;
  const outbox = {
    claimPending: jest.fn(),
    markProcessed: jest.fn(),
    markFailed: jest.fn(),
  };
  const nfseBoleto = { processEmitirNfseBoleto: jest.fn(), processEmitirFaturaPacote: jest.fn() };
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
        { provide: NfseBoletoOutboxProcessor, useValue: nfseBoleto },
        { provide: WhatsappOutboxProcessor, useValue: whatsappNotify },
        { provide: RealtimeEmitterService, useValue: realtime },
        { provide: ClsService, useValue: cls },
        { provide: AlertService, useValue: alerts },
        { provide: UnidadeProcessoOutboxProcessor, useValue: { process: jest.fn() } },
      ],
    }).compile();
    worker = module.get(OutboxWorker);
  });

  it('roteia EMITIR_NFSE_BOLETO para o processor fiscal', async () => {
    outbox.claimPending.mockResolvedValue([
      {
        id: 'e1',
        eventType: 'EMITIR_NFSE_BOLETO',
        payload: { faturaId: 'f1' },
        aggregateId: 'agg1',
      },
    ]);
    outbox.markProcessed.mockResolvedValue(undefined);

    await worker.tick();

    expect(nfseBoleto.processEmitirNfseBoleto).toHaveBeenCalledWith('e1', { faturaId: 'f1' });
    expect(outbox.markProcessed).toHaveBeenCalledWith('e1');
    expect(realtime.emitDispatchUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ status: OutboxEventStatus.PROCESSED }),
    );
  });

  it('roteia EMITIR_FATURA_PACOTE para o processor do envelope FAT', async () => {
    outbox.claimPending.mockResolvedValue([
      {
        id: 'e3',
        eventType: 'EMITIR_FATURA_PACOTE',
        payload: { faturaPacoteId: 'p1' },
        aggregateId: 'p1',
      },
    ]);
    outbox.markProcessed.mockResolvedValue(undefined);

    await worker.tick();

    expect(nfseBoleto.processEmitirFaturaPacote).toHaveBeenCalledWith('e3', { faturaPacoteId: 'p1' });
    expect(outbox.markProcessed).toHaveBeenCalledWith('e3');
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
