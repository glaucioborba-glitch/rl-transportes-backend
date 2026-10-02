import { Role, StatusSolicitacao } from '@prisma/client';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  const prisma = {
    unidade: { count: jest.fn() },
    solicitacao: { count: jest.fn(), findMany: jest.fn() },
    saida: { count: jest.fn() },
    gate: { count: jest.fn() },
    auditoria: { count: jest.fn(), groupBy: jest.fn() },
    user: { findMany: jest.fn() },
    patioUnidade: { count: jest.fn(), findMany: jest.fn() },
    patioPosicao: { aggregate: jest.fn() },
    motorista: { groupBy: jest.fn() },
    faturamentoItem: { aggregate: jest.fn() },
    $queryRaw: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.unidade.count.mockResolvedValue(2);
    prisma.solicitacao.count.mockResolvedValue(0);
    prisma.saida.count.mockResolvedValue(0);
    prisma.gate.count.mockResolvedValue(0);
    prisma.auditoria.count.mockResolvedValue(1);
    prisma.auditoria.groupBy.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.solicitacao.findMany.mockResolvedValue([]);
    prisma.patioUnidade.count.mockResolvedValue(12);
    prisma.patioUnidade.findMany.mockResolvedValue([
      {
        unidadeIso: 'ABCD1234567',
        refrigerado: false,
        solicitacao: {
          containersSolicitacao: [{ unidade: 'ABCD1234567', status: 'CHEIO' }],
        },
      },
    ]);
    prisma.patioPosicao.aggregate.mockResolvedValue({ _sum: { capacidade: 40 } });
    prisma.motorista.groupBy.mockResolvedValue([
      { status: 'EM_VIAGEM', _count: 3 },
      { status: 'DISPONIVEL', _count: 2 },
    ]);
    prisma.faturamentoItem.aggregate.mockResolvedValue({
      _sum: { valor: { toFixed: () => '1250.00' } },
    });
    prisma.$queryRaw.mockImplementation((strings: TemplateStringsArray, ..._values: unknown[]) => {
      const sql = strings.join('?');
      if (sql.includes('gate_v2_check_outs')) {
        if (sql.includes('GROUP BY hr')) {
          return Promise.resolve([{ hr: 8, tat: 38 }, { hr: 14, tat: 52 }]);
        }
        return Promise.resolve([{ m: 42 }]);
      }
      if (sql.includes('AVG(EXTRACT(EPOCH FROM (g."createdAt"')) {
        return Promise.resolve([{ m: 15 }]);
      }
      if (sql.includes('AVG(EXTRACT(EPOCH FROM (ptio."createdAt"')) {
        return Promise.resolve([{ m: 20 }]);
      }
      if (sql.includes('AVG(EXTRACT(EPOCH FROM (sa."dataHoraSaida"')) {
        return Promise.resolve([{ m: 30 }]);
      }
      if (sql.includes('AVG(EXTRACT(EPOCH FROM (NOW()')) {
        return Promise.resolve([{ m: 48 }]);
      }
      if (sql.includes('cs.tamanho')) {
        return Promise.resolve([{ tamanho: '40HC' }, { tamanho: '20DV' }]);
      }
      if (sql.includes('date_trunc') && sql.includes('faturamento_itens')) {
        return Promise.resolve([{ d: new Date('2026-06-10'), total: 800 }]);
      }
      if (sql.includes('date_trunc') && sql.includes('agendamentos_terminal')) {
        return Promise.resolve([{ d: new Date('2026-06-10'), total: 450 }]);
      }
      if (sql.includes('GROUP BY u."numeroIso"')) {
        return Promise.resolve([]);
      }
      if (sql.includes('ORDER BY volume DESC')) {
        return Promise.resolve([{ clienteId: 'c1', nome: 'ACME', volume: 3n }]);
      }
      if (sql.includes('COUNT(u.id)')) {
        return Promise.resolve([{ clienteId: 'c1', nome: 'ACME', totalUnidades: 5n }]);
      }
      if (sql.includes('COUNT(DISTINCT s.id)')) {
        return Promise.resolve([{ clienteId: 'c1', nome: 'ACME', solicitacoesElegiveis: 1n }]);
      }
      if (sql.includes('solicitacoesPendentesAprovacao')) {
        return Promise.resolve([{ clienteId: 'c1', nome: 'ACME', solicitacoesPendentesAprovacao: 2n }]);
      }
      return Promise.resolve([]);
    });

    service = new DashboardService(prisma as never);
  });

  it('monta payload com snapshot e SLA para GERENTE', async () => {
    prisma.solicitacao.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    prisma.unidade.count.mockResolvedValue(4);

    const out = await service.getDashboard(
      { status: StatusSolicitacao.APROVADO },
      {
        sub: 'u1',
        id: 'u1',
        email: 'g@t.test',
        role: Role.GERENTE,
        permissions: [],
        clienteId: null,
        cpfCnpj: '00000000000',
      },
    );

    expect(out.snapshot.unidadesEmGate).toBeDefined();
    expect(out.sla.tempoMedioPortariaGate).toBe(15);
    expect(out.conflitos.tentativas403PorEscopo).toBe(1);
    expect(out.clientes?.unidadesPorCliente[0]?.totalUnidades).toBe(5);
  });

  it('omit clientes para OPERADOR_GATE', async () => {
    prisma.solicitacao.count.mockResolvedValue(0);
    prisma.unidade.count.mockResolvedValue(0);

    const out = await service.getDashboard(
      {},
      {
        sub: 'u2',
        id: 'u2',
        email: 'op@t.test',
        role: Role.OPERADOR_GATE,
        permissions: [],
        clienteId: null,
        cpfCnpj: '00000000000',
      },
    );

    expect(out.clientes).toBeNull();
    expect(out.sla.rankingClientesPorVolume).toBeUndefined();
  });

  it('calculateKpis retorna TAT, TEU, ocupação, frota e séries', async () => {
    const kpis = await service.calculateKpis('hoje');
    expect(kpis.periodo).toBe('hoje');
    expect(kpis.tat).toBe(42);
    expect(kpis.yardOccupancy).toBe(30);
    expect(kpis.fleetEfficiency).toBe(60);
    expect(kpis.dailyRevenue).toBe(1250);
    expect(kpis.revenuePerTeu).toBeGreaterThan(0);
    expect(kpis.tatHistory).toHaveLength(24);
    expect(kpis.tatHistory[8]?.tat).toBe(38);
    expect(kpis.yardByContainerType.length).toBe(3);
    expect(kpis.revenueVsFleetCost.length).toBeGreaterThan(0);
    expect(kpis.tatDelta).toBeDefined();
  });
});
