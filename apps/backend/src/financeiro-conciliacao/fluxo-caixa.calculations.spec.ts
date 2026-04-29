import { agregarSerie12Meses, projetarFluxoCaixa } from './fluxo-caixa.calculations';

describe('fluxo-caixa.calculations', () => {
  it('projetarFluxoCaixa calcula saldo final', () => {
    const r = projetarFluxoCaixa({
      horizonteDias: 30,
      saldoInicialProxy: 10000,
      entradasEsperadasPeriodo: 5000,
      custosFixosMensais: 30000,
      saidasComprometidasPeriodo: 1000,
    });
    expect(r.saldoProjetadoFim).toBeDefined();
    expect(r.horizonteDias).toBe(30);
  });

  it('agregarSerie12Meses', () => {
    const meses = Array.from({ length: 12 }, (_, i) => ({
      mes: `2026-${String(i + 1).padStart(2, '0')}`,
      valor: 1000,
    }));
    const r = agregarSerie12Meses(meses, 22);
    expect(r.receita.length).toBe(12);
    expect(r.caixa.length).toBe(12);
  });
});
