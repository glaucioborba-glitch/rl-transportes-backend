import { Role } from '@prisma/client';
import { DashboardPerformanceService } from './dashboard-performance.service';

describe('DashboardPerformanceService', () => {
  const prisma = {
    portaria: { count: jest.fn().mockResolvedValue(10) },
    gate: { count: jest.fn().mockResolvedValue(8) },
    patio: { count: jest.fn().mockResolvedValue(6) },
    solicitacao: { count: jest.fn().mockResolvedValue(4) },
    saida: { count: jest.fn().mockResolvedValue(0) },
    auditoria: {
      groupBy: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(12),
    },
    faturamento: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { valorTotal: 1200 } }),
    },
    unidade: {
      count: jest.fn().mockResolvedValue(24),
      groupBy: jest.fn().mockResolvedValue([
        { tipo: 'IMPORT', _count: { id: 12 } },
        { tipo: 'EXPORT', _count: { id: 12 } },
      ]),
    },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };

  const config = {
    get: jest.fn((key: string) => {
      if (key === 'PERFORMANCE_CUSTO_MINUTO_PROXY') return '0.1';
      if (key === 'PERFORMANCE_FILA_GARGALO_LIMITE') return '20';
      if (key === 'PERFORMANCE_PATIO_CAPACIDADE_ESTIMADA') return '100';
      return undefined;
    }),
  };

  const admin = {
    sub: 'adm',
    id: 'adm',
    email: 'a@a.com',
    role: Role.ADMIN,
    permissions: ['dashboard:performance'],
  };

  const operador = {
    sub: 'op1',
    id: 'op1',
    email: 'op@a.com',
    role: Role.OPERADOR_GATE,
    permissions: ['dashboard:performance'],
  };

  const service = new DashboardPerformanceService(prisma as never, config as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.portaria.count.mockResolvedValue(10);
    prisma.gate.count.mockResolvedValue(8);
    prisma.patio.count.mockResolvedValue(6);
    prisma.solicitacao.count.mockResolvedValue(4);
    prisma.saida.count.mockResolvedValue(0);
    prisma.auditoria.groupBy.mockResolvedValue([]);
    prisma.auditoria.count.mockResolvedValue(12);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.faturamento.aggregate.mockResolvedValue({
      _sum: { valorTotal: 1200 },
    });
    prisma.unidade.count.mockResolvedValue(24);
    prisma.unidade.groupBy.mockResolvedValue([
      { tipo: 'IMPORT', _count: { id: 12 } },
      { tipo: 'EXPORT', _count: { id: 12 } },
    ]);
  });

  it('ADMIN retorna margemCusto e métricas estratégicas completas', async () => {
    prisma.auditoria.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { usuario: 'op1', acao: 'INSERT', _count: { id: 3 } },
        { usuario: 'op1', acao: 'UPDATE', _count: { id: 1 } },
      ]);
    prisma.user.findMany.mockResolvedValueOnce([{ id: 'op1', email: 'op@a.com' }]);
    prisma.faturamento.aggregate.mockResolvedValue({ _sum: { valorTotal: 1200 } });

    const res = await service.getPerformance({}, admin as never);

    expect(res.margemCusto).not.toBeNull();
    expect(res.margemCusto?.proxyMargem).not.toBeNull();
    expect(res.estrategicos.margemOperacionalPorCliente).not.toBeNull();
    expect(res.series.margemMensal12m).not.toBeNull();
    expect(res.produtividadeHumana.produtividadePorOperador.length).toBeGreaterThanOrEqual(1);
  });

  it('OPERADOR oculta financeiro e restrige produtividade ao próprio usuário', async () => {
    prisma.auditoria.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { usuario: 'op1', acao: 'INSERT', _count: { id: 5 } },
        { usuario: 'outro', acao: 'INSERT', _count: { id: 99 } },
      ]);
    prisma.user.findMany.mockResolvedValueOnce([
      { id: 'op1', email: 'op@a.com' },
      { id: 'outro', email: 'x@a.com' },
    ]);

    const res = await service.getPerformance({}, operador as never);

    expect(res.margemCusto).toBeNull();
    expect(res.series.margemMensal12m).toBeNull();
    expect(res.estrategicos.custoMedioPorOperacao).toBeNull();
    expect(res.gargalos.operadoresComMaisRetrabalho).toHaveLength(0);
    expect(res.produtividadeHumana.produtividadePorOperador.every((p) => p.usuarioId === 'op1')).toBe(
      true,
    );
  });
});
