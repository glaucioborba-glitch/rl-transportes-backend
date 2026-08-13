import { UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ContainerEventType, TipoContainerTos } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { OutboxService } from '../outbox/outbox.service';
import { NotificationEnqueueService } from '../notification/notification-enqueue.service';
import { PrismaService } from '../prisma/prisma.service';
import { YardSnapshotService } from '../yard-read/yard-snapshot.service';
import { ContainerLifecycleService } from './container-lifecycle.service';
import { ContainerLifecycleState } from './container-fsm.types';
import { TosEventEmitter } from './tos-event-emitter';

describe('ContainerLifecycleService', () => {
  let service: ContainerLifecycleService;
  let eventEmitter: TosEventEmitter;

  const mockContainer = {
    id: 'ctr-1',
    numero: 'ABCD1234567',
    tipo: TipoContainerTos.DRY,
    clienteId: 'cli-1',
    agendamentoId: 'ag-1',
    version: 1,
    agendamento: {
      id: 'ag-1',
      numeroIso: 'ABCD1234567',
      clienteId: 'cli-1',
      status: 'CONFIRMADO',
      solicitacaoId: null,
    },
    eventos: [] as { eventType: ContainerEventType; payload: unknown; createdAt: Date }[],
  };

  const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'ob-1' }) };
  const notificationEnqueue = {
    enqueueOperacionalInTx: jest.fn().mockResolvedValue({ id: 'wa-ob-1' }),
  };
  const yardSnapshot = { onYardMutation: jest.fn().mockResolvedValue(undefined) };

  const prisma = {
    container: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    containerEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    agendamentoTerminal: { findUnique: jest.fn() },
    cliente: { findFirst: jest.fn() },
    solicitacao: { findUnique: jest.fn() },
    avariaRecord: { create: jest.fn() },
    $transaction: jest.fn(),
  };

  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContainerLifecycleService,
        TosEventEmitter,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: OutboxService, useValue: outbox },
        { provide: NotificationEnqueueService, useValue: notificationEnqueue },
        { provide: YardSnapshotService, useValue: yardSnapshot },
      ],
    }).compile();

    service = module.get(ContainerLifecycleService);
    eventEmitter = module.get(TosEventEmitter);
  });

  it('rejeita transição inválida no estado NONE', async () => {
    prisma.container.findUnique.mockResolvedValue({ ...mockContainer, eventos: [] });

    await expect(
      service.transitionState('ctr-1', ContainerEventType.GATE_IN_COMPLETED, {}, 'u1'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('enfileira outbox BILLING_TRIGGERED no gate-out (OCC + transação)', async () => {
    const gateInAt = new Date('2026-06-01T08:00:00Z');
    const events = [
      {
        eventType: ContainerEventType.SCHEDULED,
        payload: {},
        createdAt: new Date('2026-05-31T08:00:00Z'),
      },
      {
        eventType: ContainerEventType.GATE_IN_COMPLETED,
        payload: { agendamentoQrId: 'ag-1' },
        createdAt: gateInAt,
      },
    ];

    prisma.container.findUnique.mockResolvedValue({ ...mockContainer, eventos: events });
    prisma.containerEvent.create.mockResolvedValue({
      id: 'ev-out',
      eventType: ContainerEventType.GATE_OUT_COMPLETED,
      createdAt: new Date('2026-06-03T08:00:00Z'),
    });
    prisma.container.update.mockResolvedValue({ ...mockContainer, version: 2 });

    const emitted = jest.fn();
    eventEmitter.on('container.dispatched', emitted);

    const result = await service.transitionState(
      'ctr-1',
      ContainerEventType.GATE_OUT_COMPLETED,
      {},
      'u1',
    );

    expect(result.state).toBe(ContainerLifecycleState.DISPATCHED);
    expect(result.version).toBe(2);
    expect(prisma.container.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ctr-1', version: 1 },
        data: { version: { increment: 1 } },
      }),
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ eventType: 'BILLING_TRIGGERED', aggregateId: 'ctr-1' }),
    );
    expect(emitted).toHaveBeenCalledWith(
      expect.objectContaining({
        containerId: 'ctr-1',
        diasEstadia: 2,
      }),
    );
  });
});
