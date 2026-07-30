import {
  calcularArmazenagemEscalonada,
  FAIXAS_DIARIA_PADRAO,
} from './faixa-diaria-calculator';

describe('FaixaDiariaCalculator', () => {
  const faixas = FAIXAS_DIARIA_PADRAO;

  it('7 dias free + 18 dias permanência = R$ 375', () => {
    expect(calcularArmazenagemEscalonada(18, 7, faixas)).toBe(375);
  });

  it('dentro do free time = R$ 0', () => {
    expect(calcularArmazenagemEscalonada(7, 7, faixas)).toBe(0);
    expect(calcularArmazenagemEscalonada(5, 7, faixas)).toBe(0);
  });

  it('free time comercial 15 dias — só cobra a partir do dia 16', () => {
    expect(calcularArmazenagemEscalonada(20, 15, faixas)).toBe(45 + 45 + 45 + 45 + 45);
  });

  it('sem faixas = R$ 0', () => {
    expect(calcularArmazenagemEscalonada(20, 7, [])).toBe(0);
  });
});
