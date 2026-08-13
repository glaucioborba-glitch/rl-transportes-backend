import { Test, TestingModule } from '@nestjs/testing';
import { OutboxEventStatus, TipoOperacaoSolicitacaoIntent } from '@prisma/client';
import { BillingListener } from './billing.listener';
import { TosEventEmitter } from './tos-event-emitter';
import { CONTAINER_DISPATCHED_EVENT, type ContainerDispatchedPayload } from './container-lifecycle.service';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BillingListener', () => {
  let listener: BillingListener;
  let emitter: TosEventEmitter;
  const outbox = { enqueueStandalone: jest.fn() };
  const prisma = {
    outboxEvent: { findFirst: jest.fn() },
    solicitacao: { findUnique: jest.fn() },
  };

  const payload: ContainerDispatchedPayload = {
    containerId: 'ctr-1',
    clienteId: 'cli-1',
    agendamentoId: 'ag-1',
    gateInAt: new Date('2026-06-01'),
    gateOutAt: new Date('2026-06-10'),
    diasEstadia: 9,
    tipo: 'DRY',
    numero: 'ABCD1234567',
    solicitacaoId: 'sol-1',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.outboxEvent.findFirst.mockResolvedValue(null);
    prisma.solicitacao.findUnique.mockResolvedValue({
      tipoOperacao: TipoOperacaoSolicitacaoIntent.SOLICITAR_TRANSFERENCIA,
    });
    outbox.enqueueStandalone.mockResolvedValue({ id: 'ob-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingListener,
        TosEventEmitter,
        { provide: PrismaService, useValue: prisma },
        { provide: OutboxService, useValue: outbox },
      ],
    }).compile();

    listener = module.get(BillingListener);
    emitter = module.get(TosEventEmitter);
    listener.onModuleInit();
  });

  it('enfileira BILLING_TRIGGERED em container.dispatched para intent elegível', async () => {
    emitter.emit(CONTAINER_DISPATCHED_EVENT, payload);
    await new Promise((r) => setTimeout(r, 20));

    expect(outbox.enqueueStandalone).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'BILLING_TRIGGERED',
        aggregateId: 'ctr-1',
      }),
    );
  });

  it('não duplica se outbox BILLING_TRIGGERED já existe', async () => {
    prisma.outboxEvent.findFirst.mockResolvedValue({ id: 'existing' });
    emitter.emit(CONTAINER_DISPATCHED_EVENT, payload);
    await new Promise((r) => setTimeout(r, 20));

    expect(outbox.enqueueStandalone).not.toHaveBeenCalled();
  });

  it('ignora intent não elegível', async () => {
    prisma.solicitacao.findUnique.mockResolvedValue({
      tipoOperacao: 'OPERACAO_NAO_FATURAVEL' as TipoOperacaoSolicitacaoIntent,
    });
    emitter.emit(CONTAINER_DISPATCHED_EVENT, payload);
    await new Promise((r) => setTimeout(r, 20));

    expect(outbox.enqueueStandalone).not.toHaveBeenCalled();
  });
});
