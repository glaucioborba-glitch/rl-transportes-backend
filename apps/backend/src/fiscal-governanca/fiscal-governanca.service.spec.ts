import { Test, TestingModule } from '@nestjs/testing';
import { FiscalGovernancaService } from './fiscal-governanca.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FiscalGovernancaService', () => {
  let service: FiscalGovernancaService;

  const prismaMock = {
    $queryRaw: jest.fn(),
    faturamentoItem: { findMany: jest.fn() },
    boleto: { findMany: jest.fn(), count: jest.fn() },
    nfsEmitida: { findMany: jest.fn() },
    faturamentoSolicitacao: { findMany: jest.fn() },
    auditoria: { findMany: jest.fn() },
    solicitacao: { count: jest.fn() },
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    prismaMock.$queryRaw.mockImplementation((strings: TemplateStringsArray) => {
      const q = strings.join(' ');
      if (q.includes('SUM("valorTotal")')) return Promise.resolve([{ s: null }]);
      if (q.includes('auditorias')) return Promise.resolve([{ c: BigInt(0) }]);
      return Promise.resolve([]);
    });
    prismaMock.faturamentoItem.findMany.mockResolvedValue([]);
    prismaMock.boleto.findMany.mockResolvedValue([]);
    prismaMock.boleto.count.mockResolvedValue(0);
    prismaMock.nfsEmitida.findMany.mockResolvedValue([]);
    prismaMock.faturamentoSolicitacao.findMany.mockResolvedValue([]);
    prismaMock.solicitacao.count.mockResolvedValue(0);
    prismaMock.auditoria.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FiscalGovernancaService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(FiscalGovernancaService);
  });

  it('getConciliacao retorna estrutura', async () => {
    const r = await service.getConciliacao({ dias: 30 });
    expect(r).toHaveProperty('divergencias');
    expect(r.periodoDias).toBe(30);
  });

  it('getAuditoriaInteligente retorna scores', async () => {
    const r = await service.getAuditoriaInteligente({ dias: 7 });
    expect(r).toHaveProperty('scoreRiscoOperacional');
    expect(r).toHaveProperty('scoreRiscoFiscal');
  });
});
