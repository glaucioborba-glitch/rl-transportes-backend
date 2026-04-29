import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PlanejamentoPessoalService } from './planejamento-pessoal.service';
import { PrismaService } from '../prisma/prisma.service';
import { TurnoPlanejamentoPessoal } from './planejamento-pessoal.turno';

describe('PlanejamentoPessoalService', () => {
  let service: PlanejamentoPessoalService;

  const prismaMock = {
    $queryRaw: jest.fn(),
    auditoria: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    patio: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    prismaMock.$queryRaw.mockImplementation((strings: TemplateStringsArray) => {
      const q = strings.join(' ');
      if (q.includes('dataHoraSaida')) {
        return Promise.resolve([{ mes: '2025-01', n: BigInt(100) }]);
      }
      if (q.includes('auditorias')) {
        return Promise.resolve([
          { turno: 'MANHA', ops: BigInt(300), usuarios: BigInt(5) },
          { turno: 'TARDE', ops: BigInt(280), usuarios: BigInt(5) },
          { turno: 'NOITE', ops: BigInt(120), usuarios: BigInt(3) },
        ]);
      }
      if (q.includes('EXTRACT(EPOCH')) {
        return Promise.resolve([{ m: 210 }]);
      }
      return Promise.resolve([]);
    });
    prismaMock.auditoria.count.mockResolvedValue(900);
    prismaMock.auditoria.groupBy.mockResolvedValue([
      { usuario: 'a', _count: { id: 10 } },
      { usuario: 'b', _count: { id: 10 } },
    ]);
    prismaMock.patio.count.mockResolvedValue(40);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanejamentoPessoalService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string, def?: string) =>
              ({
                PERFORMANCE_PATIO_CAPACIDADE_ESTIMADA: '200',
                PERFORMANCE_CUSTO_MINUTO_PROXY: '0.05',
                PLANEJAMENTO_OPEX_TURNO_FIXO_MENSAL: '42000',
                PLANEJAMENTO_OPEX_OPERADOR_MES: '8500',
                PLANEJAMENTO_OPEX_PATIO_VAR_PCT: '18000',
              } as Record<string, string>)[k] ?? def,
          },
        },
      ],
    }).compile();

    service = module.get(PlanejamentoPessoalService);
  });

  it('getHeadcountOtimo retorna estrutura esperada', async () => {
    const r = await service.getHeadcountOtimo({
      turno: TurnoPlanejamentoPessoal.MANHA,
      demandaPrevista: 120,
      produtividadeHistorica: 15,
    });
    expect(r.headcountRecomendado).toBeGreaterThan(0);
    expect(r.turno).toBe(TurnoPlanejamentoPessoal.MANHA);
  });

  it('getOrcamentoAnual retorna 12 meses', async () => {
    const r = await service.getOrcamentoAnual({});
    expect(r.custoMensal.length).toBe(12);
    expect(r.deltaMesAMesPct.length).toBe(12);
  });

  it('getContratacao aceita demanda12Meses válida', async () => {
    const csv = Array(12).fill(1000).join(',');
    const r = await service.getContratacao({
      demanda12Meses: csv,
      produtividadePorOperadorMes: 500,
      headcountAtual: 20,
    });
    expect(r.previsaoContratar).toBeGreaterThanOrEqual(0);
    expect(r.demandaMensalReferencia.length).toBe(12);
  });

  it('getMatrizTurnos retorna três turnos', async () => {
    const r = await service.getMatrizTurnos();
    expect(r.turnos.length).toBe(3);
  });
});
