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
    prisma.$queryRaw.mockImplementation((strings: TemplateStringsArray, ..._values: unknown[]) => {
      const sql = strings.join('?');
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
      },
    );

    expect(out.clientes).toBeNull();
    expect(out.sla.rankingClientesPorVolume).toBeUndefined();
  });
});
