import {
  assertVencimentosValidos,
  formatVencimentosLabel,
  montarParcelasFinanceiras,
  parseVencimentosInput,
  ratearValorEmParcelas,
} from './prazo-parcelas.util';

describe('prazo-parcelas.util', () => {
  it('parseia 7/14/21 e lista numérica', () => {
    expect(parseVencimentosInput('7/14/21')).toEqual([7, 14, 21]);
    expect(parseVencimentosInput('30, 60, 90')).toEqual([30, 60, 90]);
    expect(parseVencimentosInput([0])).toEqual([0]);
  });

  it('rejeita vencimentos que não crescem', () => {
    expect(() => assertVencimentosValidos([30, 30])).toThrow(/crescentes/);
    expect(() => assertVencimentosValidos([60, 30])).toThrow(/crescentes/);
  });

  it('à vista é uma parcela no dia 0', () => {
    expect(assertVencimentosValidos([0])).toEqual([0]);
  });

  it('rateia centavos na última parcela', () => {
    expect(ratearValorEmParcelas(100, 3)).toEqual([33.33, 33.33, 33.34]);
  });

  it('monta 2 boletos para 30/60', () => {
    const parcelas = montarParcelasFinanceiras({
      emissao: new Date('2026-08-16T12:00:00Z'),
      valorTotal: 1000,
      vencimentos: [30, 60],
    });
    expect(parcelas).toHaveLength(2);
    expect(parcelas[0]?.valor).toBe(500);
    expect(parcelas[1]?.valor).toBe(500);
    expect(parcelas[0]?.vencimento.toISOString().slice(0, 10)).toBe('2026-09-15');
    expect(parcelas[1]?.vencimento.toISOString().slice(0, 10)).toBe('2026-10-15');
  });

  it('formata rótulo visual', () => {
    expect(formatVencimentosLabel([7, 14, 21])).toBe('7 / 14 / 21');
  });
});
