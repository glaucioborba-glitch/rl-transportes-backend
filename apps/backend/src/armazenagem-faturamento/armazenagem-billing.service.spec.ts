import { Test, TestingModule } from '@nestjs/testing';
import { StatusPreFatura } from '@prisma/client';
import { BillingRuleEngineService } from '../billing-engine/billing-rule-engine.service';
import { ArmazenagemBillingService } from './armazenagem-billing.service';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ArmazenagemBillingService', () => {
  let service: ArmazenagemBillingService;
  const prisma = {
    tabelaTarifaria: { findUnique: jest.fn(), create: jest.fn() },
    preFatura: { findMany: jest.fn(), update: jest.fn(), upsert: jest.fn(), findFirst: jest.fn() },
    patioUnidade: { findMany: jest.fn(), findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const outbox = { enqueue: jest.fn() };
  const ruleEngine = {
    resolvePricingForCliente: jest.fn(),
    loadContainerContext: jest.fn(),
    evaluateForContainerCycle: jest.fn(),
    persistItens: jest.fn(),
    sumItensTotal: jest.fn(),
    cobrancaInicioEm: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    ruleEngine.resolvePricingForCliente.mockResolvedValue({
      source: 'LEGADO',
      regras: [],
      legado: { freeTimeDias: 5, valorDiaria: 85, valorServicosExtras: 0 },
    });
    ruleEngine.loadContainerContext.mockResolvedValue({ tamanho: '40', tipo: 'DRY' });
    ruleEngine.evaluateForContainerCycle.mockReturnValue({
      valorTotal: 0,
      diasFaturaveis: 0,
      diasFreeTime: 5,
      items: [],
    });
    ruleEngine.sumItensTotal.mockResolvedValue(0);
    ruleEngine.cobrancaInicioEm.mockReturnValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArmazenagemBillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: OutboxService, useValue: outbox },
        { provide: BillingRuleEngineService, useValue: ruleEngine },
      ],
    }).compile();
    service = module.get(ArmazenagemBillingService);
  });

  it('openPreFaturasForGateIn cria upsert por ISO do pátio', async () => {
    prisma.tabelaTarifaria.findUnique.mockResolvedValue({ id: 't1', clienteId: 'c1' });
    prisma.patioUnidade.findMany.mockResolvedValue([{ unidadeIso: 'ABCD1234567' }]);
    prisma.preFatura.upsert.mockResolvedValue({ id: 'pf1' });

    const tx = {
      tabelaTarifaria: prisma.tabelaTarifaria,
      patioUnidade: prisma.patioUnidade,
      preFatura: { ...prisma.preFatura, update: jest.fn() },
      fatura: { findFirst: jest.fn() },
    };
    const gateInAt = new Date('2026-06-01T10:00:00.000Z');
    await service.openPreFaturasForGateIn('gi1', 'c1', gateInAt, tx as never);

    expect(prisma.preFatura.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { gateInId_containerIso: { gateInId: 'gi1', containerIso: 'ABCD1234567' } },
        create: expect.objectContaining({
          status: StatusPreFatura.ABERTA,
          gateInId: 'gi1',
          clienteId: 'c1',
        }),
      }),
    );
    expect(ruleEngine.evaluateForContainerCycle).toHaveBeenCalledWith(
      expect.objectContaining({ fase: 'GATE_IN' }),
    );
  });

  it('consolidateOnGateOut cria fatura PROCESSANDO e enfileira EMITIR_NFSE_BOLETO', async () => {
    const gateOutAt = new Date('2026-06-10T12:00:00.000Z');
    const gateInAt = new Date('2026-06-01T10:00:00.000Z');
    const preFatura = {
      id: 'pf1',
      clienteId: 'c1',
      containerIso: 'ABCD1234567',
      gateInId: 'gi1',
      status: StatusPreFatura.ABERTA,
      gateIn: { dataHora: gateInAt },
    };
    ruleEngine.evaluateForContainerCycle.mockReturnValue({
      valorTotal: 425,
      diasFaturaveis: 4,
      diasFreeTime: 5,
      items: [{ eventoGatilho: 'DIARIA_ARMAZENAGEM', valorTotal: 340 }],
    });
    const tx = {
      preFatura: {
        findMany: jest.fn().mockResolvedValue([preFatura]),
        update: jest.fn().mockResolvedValue({ ...preFatura, status: StatusPreFatura.CONSOLIDADA }),
      },
      tabelaTarifaria: {
        findUnique: jest.fn().mockResolvedValue({ id: 't1', clienteId: 'c1' }),
        create: jest.fn(),
      },
      fatura: { create: jest.fn().mockResolvedValue({ id: 'fat1' }) },
    };
    await service.consolidateOnGateOut('gi1', gateOutAt, tx as never);

    expect(tx.fatura.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statusPagamento: 'PROCESSANDO' }),
      }),
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ eventType: 'EMITIR_NFSE_BOLETO' }),
    );
  });
});
