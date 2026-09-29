import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { StatusPreFatura } from '@prisma/client';
import { AlertService } from '../alert/alert.service';
import { BillingRuleEngineService } from '../billing-engine/billing-rule-engine.service';
import { ArmazenagemBillingService } from './armazenagem-billing.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ArmazenagemBillingService', () => {
  let service: ArmazenagemBillingService;
  const prisma = {
    preFatura: { findMany: jest.fn(), update: jest.fn(), upsert: jest.fn(), findFirst: jest.fn() },
    patioUnidade: { findMany: jest.fn(), findFirst: jest.fn(), findFirstOrThrow: jest.fn() },
    cliente: { findUnique: jest.fn().mockResolvedValue({ tenantId: 'default' }) },
    tabelaPreco: { findFirst: jest.fn().mockResolvedValue({ regras: [{ diasFreeTime: 5 }] }) },
    unidadeProcessoServico: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(),
  };
  const alerts = { fiscalIpmDown: jest.fn(), faturamentoReconcileFailed: jest.fn() };
  const ruleEngine = {
    resolvePricingForCliente: jest.fn(),
    loadContainerContext: jest.fn(),
    evaluateForContainerCycle: jest.fn(),
    evaluateForContainerCycleWithTenant: jest.fn(),
    persistItens: jest.fn(),
    sumItensTotal: jest.fn(),
    cobrancaInicioEm: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    ruleEngine.resolvePricingForCliente.mockResolvedValue({
      source: 'TABELA_PRECO',
      tabelaPrecoId: 'tp1',
      regras: [],
    });
    ruleEngine.loadContainerContext.mockResolvedValue({ tamanho: '40', tipo: 'DRY' });
    ruleEngine.evaluateForContainerCycleWithTenant.mockResolvedValue({
      valorTotal: 0,
      diasFaturaveis: 0,
      diasFreeTime: 5,
      items: [],
    });
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
        { provide: BillingRuleEngineService, useValue: ruleEngine },
        { provide: AlertService, useValue: alerts },
      ],
    }).compile();
    service = module.get(ArmazenagemBillingService);
  });

  it('openPreFaturasForGateIn cria upsert por ISO do pátio', async () => {
    prisma.patioUnidade.findMany.mockResolvedValue([{ unidadeIso: 'ABCD1234567' }]);
    prisma.preFatura.upsert.mockResolvedValue({ id: 'pf1' });

    const tx = {
      patioUnidade: prisma.patioUnidade,
      preFatura: { ...prisma.preFatura, update: jest.fn() },
      cliente: { findUnique: jest.fn().mockResolvedValue({ tenantId: 'default' }) },
      fatura: { findFirst: jest.fn() },
      itemFaturaArmazenagem: { deleteMany: jest.fn(), createMany: jest.fn(), findFirst: jest.fn() },
      unidadeProcessoServico: { findMany: jest.fn().mockResolvedValue([]) },
      frete: { findFirst: jest.fn().mockResolvedValue(null) },
      unidadeProcesso: { findUnique: jest.fn().mockResolvedValue(null) },
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
    expect(ruleEngine.evaluateForContainerCycleWithTenant).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({ fase: 'GATE_IN' }),
    );
  });

  it('consolidateOnGateOut cria fatura PENDENTE na fila da Fatura (sem emitir NFS-e)', async () => {
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
      cliente: { findUnique: jest.fn().mockResolvedValue({ tenantId: 'default' }) },
      fatura: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'fat1' }),
      },
      itemFaturaArmazenagem: { deleteMany: jest.fn(), createMany: jest.fn(), findFirst: jest.fn() },
      unidadeProcessoServico: { findMany: jest.fn().mockResolvedValue([]) },
      frete: { findFirst: jest.fn().mockResolvedValue(null) },
      unidadeProcesso: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    ruleEngine.evaluateForContainerCycleWithTenant.mockResolvedValue({
      valorTotal: 425,
      diasFaturaveis: 4,
      diasFreeTime: 5,
      items: [{ eventoGatilho: 'DIARIA_ARMAZENAGEM', valorTotal: 340 }],
    });
    await service.consolidateOnGateOut('gi1', gateOutAt, tx as never);

    expect(tx.fatura.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statusPagamento: 'PENDENTE' }),
      }),
    );
  });

  it('consolidateOnGateOut lança ConflictException se fatura já existe', async () => {
    const gateOutAt = new Date('2026-06-10T12:00:00.000Z');
    const tx = {
      fatura: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'fat-existing',
          preFatura: { containerIso: 'ABCD1234567' },
        }),
      },
      preFatura: { findMany: jest.fn() },
    };

    await expect(service.consolidateOnGateOut('gi1', gateOutAt, tx as never)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('reconcileClosedProcessoPrefaturas consolida ID encerrado com pré-fatura aberta', async () => {
    const saidaEm = new Date('2026-08-26T12:00:00.000Z');
    prisma.preFatura.findMany.mockResolvedValue([
      {
        id: 'pf-stale',
        unidadeProcessoId: 'up1',
        fatura: null,
        unidadeProcesso: { id: 'up1', numero: 1284, saidaEm, updatedAt: saidaEm },
      },
    ]);
    const tx = {
      preFatura: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      fatura: { create: jest.fn() },
      cliente: { findUnique: jest.fn() },
    };
    prisma.$transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
    const spy = jest.spyOn(service, 'consolidateOnProcesso').mockResolvedValue(undefined as never);

    const out = await service.reconcileClosedProcessoPrefaturas();
    expect(out.consolidados).toBe(1);
    expect(out.falhas).toBe(0);
    expect(spy).toHaveBeenCalledWith('up1', saidaEm, tx);
    spy.mockRestore();
  });

  it('openPreFaturasForProcesso não cria pré-fatura se a diária estiver ausente', async () => {
    const { UnprocessableEntityException } = await import('@nestjs/common');
    prisma.patioUnidade.findMany.mockResolvedValue([
      { unidadeIso: 'GCXU5119401', solicitacaoId: 'sol-in' },
    ]);
    ruleEngine.evaluateForContainerCycleWithTenant.mockRejectedValue(
      new UnprocessableEntityException(
        'Tabela de preços sem diária de armazenagem para este tipo de contêiner. Ajuste a tabela padrão ou a tabela do cliente.',
      ),
    );
    const tx = {
      patioUnidade: prisma.patioUnidade,
      preFatura: { findFirst: jest.fn().mockResolvedValue(null), upsert: jest.fn(), update: jest.fn() },
      cliente: { findUnique: jest.fn().mockResolvedValue({ tenantId: 'default' }) },
      fatura: { findFirst: jest.fn() },
      unidadeProcessoServico: { findMany: jest.fn().mockResolvedValue([]) },
    };

    await expect(
      service.openPreFaturasForProcesso(
        {
          unidadeProcessoId: 'up1',
          clienteId: 'c1',
          entradaEm: new Date('2026-09-18T10:00:00.000Z'),
        },
        tx as never,
      ),
    ).resolves.toBeUndefined();
    expect(tx.preFatura.upsert).not.toHaveBeenCalled();
  });
});
