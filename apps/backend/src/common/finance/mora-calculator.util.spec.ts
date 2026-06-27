import { calcularMora } from './mora-calculator.util';

describe('calcularMora', () => {
  const vencimento = new Date('2026-06-01T12:00:00.000Z');

  it('sem atraso retorna valor original', () => {
    const r = calcularMora({
      valorOriginal: 1000,
      dataVencimento: vencimento,
      asOf: new Date('2026-06-01T15:00:00.000Z'),
      percentualMultaAtraso: 2,
      percentualJurosAoMes: 1,
    });
    expect(r.diasAtraso).toBe(0);
    expect(r.valorAtualizado).toBe(1000);
  });

  it('aplica multa e juros pro rata die', () => {
    const r = calcularMora({
      valorOriginal: 1000,
      dataVencimento: vencimento,
      asOf: new Date('2026-06-11T12:00:00.000Z'),
      percentualMultaAtraso: 2,
      percentualJurosAoMes: 1,
    });
    expect(r.diasAtraso).toBe(10);
    expect(r.valorMulta).toBe(20);
    expect(r.valorJuros).toBe(3.33);
    expect(r.valorAtualizado).toBe(1023.33);
  });
});
