import { DashboardFinanceiroService } from './dashboard-financeiro.service';

describe('DashboardFinanceiroService', () => {
  const prisma = {
    faturamento: { aggregate: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
    faturamentoItem: { aggregate: jest.fn(), groupBy: jest.fn() },
    faturamentoSolicitacao: { findMany: jest.fn() },
    boleto: { count: jest.fn(), aggregate: jest.fn(), groupBy: jest.fn() },
    cliente: { findMany: jest.fn(), findFirst: jest.fn() },
    unidade: { count: jest.fn() },
    $queryRaw: jest.fn(),
  };

  let service: DashboardFinanceiroService;

  beforeEach(() => {
    jest.clearAllMocks();

    const dec = (v: string) => ({ toFixed: () => v });

    prisma.faturamento.aggregate.mockResolvedValue({
      _sum: { valorTotal: dec('1000.00') },
      _count: 2,
    });
    prisma.faturamento.findMany.mockResolvedValue([
      { valorTotal: dec('600.00'), statusBoleto: 'PAGO' },
      { valorTotal: dec('400.00'), statusBoleto: 'PENDENTE' },
    ]);
    prisma.faturamento.groupBy.mockResolvedValue([
      { clienteId: 'c1', _sum: { valorTotal: dec('1000.00') } },
    ]);
    prisma.faturamentoItem.aggregate.mockResolvedValue({ _sum: { valor: dec('1000.00') } });
    prisma.faturamentoItem.groupBy.mockResolvedValue([
      { descricao: ' Armazenagem ', _sum: { valor: dec('900.00') } },
    ]);
    prisma.faturamentoSolicitacao.findMany.mockResolvedValue([{ solicitacaoId: 's1' }]);
    prisma.boleto.count.mockResolvedValue(0);
    prisma.boleto.aggregate.mockResolvedValue({ _sum: { valorBoleto: dec('0') } });
    prisma.boleto.groupBy.mockResolvedValue([]);
    prisma.cliente.findMany.mockResolvedValue([{ id: 'c1', nome: 'Cliente', tipo: 'PJ' as never }]);
    prisma.cliente.findFirst.mockResolvedValue(null);
    prisma.unidade.count.mockResolvedValue(4);

    prisma.$queryRaw.mockImplementation((strings: TemplateStringsArray) => {
      const sql = strings.join(' ');
      if (sql.includes('faixa')) {
        return Promise.resolve([{ faixa: '0-30', valor: '100', qtd: 2n }]);
      }
      if (sql.includes('FROM faturamentos f')) {
        return Promise.resolve([
          {
            faturado: '1000',
            recebido: '600',
            pendente: '400',
            vencido: '0',
          },
        ]);
      }
      return Promise.resolve([]);
    });

    service = new DashboardFinanceiroService(prisma as never);
  });

  it('compõe snapshot e donut a partir de status de boleto nos faturamentos', async () => {
    const out = await service.getExecutivo({
      periodoInicio: '2026-04',
      periodoFim: '2026-04',
    });

    expect(out.snapshot.faturamentoTotalPeriodo).toBe(1000);
    expect(out.snapshot.faturamentoConcluidoVsPendente.concluido).toBe(600);
    expect(out.snapshot.faturamentoConcluidoVsPendente.pendente).toBe(400);
    expect(out.receita.faturamentoPorServico[0].descricaoLinha).toBe('Armazenagem');
    expect(out.rentabilidade.proxyMargemOperacional).toBe(250);
    expect(out.clientes.curvaAbc[0].classe).toBe('A');
  });
});
