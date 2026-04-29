import type { DespesaEntity } from './tesouraria.domain';
import {
  gerarSugestoes,
  isOpexCategoria,
  projetarCurvasOpexCapex12Meses,
  resolverStatusDespesa,
  somaSaidaOpexNoPeriodo,
  valorContratoComReajuste,
  avaliarRiscoSaidasFinanceiras,
} from './tesouraria.calculations';

describe('tesouraria.calculations', () => {
  const despBase = (over: Partial<DespesaEntity>): DespesaEntity => ({
    id: 'd1',
    fornecedor: 'ACME',
    categoria: 'OPEX',
    descricao: 'teste',
    valor: 1000,
    vencimento: '2026-06-15',
    status: 'pendente',
    recorrencia: 'nenhuma',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  });

  it('resolverStatusDespesa marca atrasado quando vencimento passou', () => {
    const hoje = new Date('2026-08-01');
    expect(resolverStatusDespesa('pendente', '2026-06-01', hoje)).toBe('atrasado');
    expect(resolverStatusDespesa('pago', '2026-06-01', hoje)).toBe('pago');
  });

  it('valorContratoComReajuste aplica taxa composta anual', () => {
    const v = valorContratoComReajuste(1000, 10, '2025-01-01', '2027-06-01');
    expect(v).toBe(1210);
  });

  it('somaSaidaOpexNoPeriodo exclui CAPEX', () => {
    const ini = new Date('2026-04-01');
    const fim = new Date('2026-04-30');
    const despesas = [
      despBase({
        id: 'o1',
        categoria: 'OPEX',
        valor: 100,
        vencimento: '2026-04-10',
      }),
      despBase({
        id: 'x1',
        categoria: 'CAPEX',
        valor: 99999,
        vencimento: '2026-04-12',
      }),
    ];
    const nome = () => 'Forn';
    const s = somaSaidaOpexNoPeriodo(despesas, [], nome, ini, fim);
    expect(s).toBe(100);
  });

  it('projetarCurvasOpexCapex12Meses separa CAPEX', () => {
    const despesas = [
      despBase({
        id: 'o1',
        categoria: 'OPEX',
        valor: 50,
        vencimento: '2026-06-01',
        recorrencia: 'mensal',
      }),
      despBase({
        id: 'x1',
        categoria: 'CAPEX',
        valor: 1200,
        vencimento: '2026-06-15',
        recorrencia: 'nenhuma',
      }),
    ];
    const ref = new Date('2026-06-01');
    const r = projetarCurvasOpexCapex12Meses(despesas, [], () => 'F', ref);
    const junho = r.curvaOpex12Meses.find((m) => m.mes === '2026-06');
    const junhoCx = r.curvaCapex12Meses.find((m) => m.mes === '2026-06');
    expect(junho?.valor).toBeGreaterThanOrEqual(50);
    expect(junhoCx?.valor).toBe(1200);
  });

  it('isOpexCategoria cobre categorias operacionais', () => {
    expect(isOpexCategoria('TI')).toBe(true);
    expect(isOpexCategoria('CAPEX')).toBe(false);
  });

  it('avaliarRiscoSaidasFinanceiras retorna alto quando ratio alto', () => {
    expect(
      avaliarRiscoSaidasFinanceiras({
        totalPendenteProx30d: 900,
        saldoProxy: 100,
        entradasPrevistas30d: 100,
        despesasAtrasadasCount: 0,
      }),
    ).toBe('alto');
  });

  it('gerarSugestoes detecta duplicidade potencial', () => {
    const despesas = [
      despBase({ id: 'a', fornecedor: 'Dup', valor: 300, vencimento: '2026-05-10' }),
      despBase({ id: 'b', fornecedor: 'Dup', valor: 300, vencimento: '2026-05-18' }),
    ];
    const s = gerarSugestoes({
      despesas,
      contratos: [],
      fornecedores: [],
      estouroCaixaPotencial: false,
    });
    expect(s.some((x) => x.tipo === 'duplicidade_potencial')).toBe(true);
  });

  it('gerarSugestoes inclui risco de caixa quando flag', () => {
    const s = gerarSugestoes({
      despesas: [],
      contratos: [],
      fornecedores: [],
      estouroCaixaPotencial: true,
    });
    expect(s.some((x) => x.tipo === 'risco_caixa')).toBe(true);
  });
});
