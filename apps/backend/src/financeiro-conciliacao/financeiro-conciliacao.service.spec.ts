import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FinanceiroConciliacaoService } from './financeiro-conciliacao.service';
import { ExtratoStoreService } from './extrato-store.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FinanceiroConciliacaoService', () => {
  let service: FinanceiroConciliacaoService;

  const prismaMock = {
    boleto: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    auditoria: { create: jest.fn() },
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    prismaMock.boleto.findMany.mockResolvedValue([]);
    prismaMock.boleto.aggregate.mockResolvedValue({ _sum: { valorBoleto: null } });
    prismaMock.$queryRaw.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceiroConciliacaoService,
        ExtratoStoreService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ConfigService,
          useValue: {
            get: () => undefined,
          },
        },
      ],
    }).compile();

    service = module.get(FinanceiroConciliacaoService);
  });

  it('importarExtrato CSV retorna batchId', async () => {
    const r = await service.importarExtrato({
      formato: 'CSV',
      conteudo: 'data,valor,historico\n2026-04-28,10,x',
    });
    expect(r.linhasImportadas).toBeGreaterThanOrEqual(1);
    expect(r.batchId).toBeDefined();
  });

  it('conciliacaoManual chama auditoria', async () => {
    prismaMock.auditoria.create.mockResolvedValue({ id: 'a1' });
    const r = await service.conciliacaoManual(
      { extratoLinhaId: 'l1', boletoId: 'b1', faturamentoId: 'f1' },
      'user-1',
    );
    expect(r.ok).toBe(true);
    expect(prismaMock.auditoria.create).toHaveBeenCalled();
  });
});
