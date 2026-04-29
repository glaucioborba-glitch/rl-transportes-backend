import {
  calcCenarioPessoal,
  calcHeadcountOtimo,
  calcOrcamentoAnualPessoal,
  calcProjecaoContratacao,
  extrairCustoMensalPessoalProxy,
  linhaMatrizTurno,
} from './planejamento-pessoal.calculations';
import { TurnoPlanejamentoPessoal } from './planejamento-pessoal.turno';

describe('planejamento-pessoal.calculations', () => {
  it('calcHeadcountOtimo recomenda headcount e risco', () => {
    const r = calcHeadcountOtimo({
      demandaPrevistaDia: 100,
      produtividadePorOperadorDia: 10,
      headcountAtual: 8,
    });
    expect(r.headcountRecomendado).toBe(10);
    expect(r.deficitOuExcessoAtual).toBe(-2);
    expect(r.tipoSaldo).toBe('deficit');
    expect(r.riscoOperacionalPct).toBeGreaterThan(0);
  });

  it('calcOrcamentoAnualPessoal aplica encargos e delta mês a mês', () => {
    const base = Array.from({ length: 12 }, (_, i) => 100_000 + i * 500);
    const r = calcOrcamentoAnualPessoal({
      custoMensalBasePessoal: base,
      coeficienteEncargos: 1.78,
      custoHoraExtraProxyPct: 10,
    });
    expect(r.custoMensal.length).toBe(12);
    expect(r.custoAnualPrevisto).toBeGreaterThan(0);
    expect(r.deltaMesAMesPct[0]).toBeNull();
    expect(r.deltaMesAMesPct[1]).not.toBeNull();
  });

  it('extrairCustoMensalPessoalProxy respeita limites de share', () => {
    const meses = Array.from({ length: 12 }, (_, i) => ({
      mes: `2026-${String(i + 1).padStart(2, '0')}`,
      valor: 50_000,
    }));
    const out = extrairCustoMensalPessoalProxy(meses, 0.52);
    expect(out.every((x) => x === 26_000)).toBe(true);
  });

  it('calcCenarioPessoal retorna impactos coerentes', () => {
    const r = calcCenarioPessoal({
      contratar: 2,
      demitir: 0,
      volumeEstimadoNovoClienteMes: 400,
      capacidadeBaseUnidadesMes: 5000,
      cicloMedioMinutosBase: 200,
      custoPorOperadorHoraProxy: 35,
      headcountProximoBase: 18,
    });
    expect(r.impactoCapacidadeUnidadesMesPct).toBeDefined();
    expect(r.requisitoTreinamentoHoras).toBeGreaterThan(0);
  });

  it('linhaMatrizTurno preenche métricas por turno', () => {
    const linha = linhaMatrizTurno({
      turno: TurnoPlanejamentoPessoal.TARDE,
      operacoesPeriodo: 900,
      usuariosDistintos: 5,
      diasPeriodo: 30,
      custoOperadorMesProxy: 8000,
      capacidadeReferenciaMesUnidades: 4000,
    });
    expect(linha.turno).toBe(TurnoPlanejamentoPessoal.TARDE);
    expect(linha.produtividadeRelativa).toBeGreaterThan(0);
    expect(linha.operadorHoraNecessarioMes).toBeGreaterThan(0);
  });

  it('calcProjecaoContratacao usa capacidade anual por operador', () => {
    const r = calcProjecaoContratacao({
      demanda12Meses: Array(12).fill(4800),
      produtividadePorOperadorMes: 400,
      headcountAtual: 10,
      custoContratacaoPorHeadProxy: 4000,
      margemPorOperadorMesProxy: 2000,
    });
    expect(r.previsaoContratar).toBe(2);
    expect(r.roiContratacaoProxy).toBeGreaterThan(0);
  });
});
