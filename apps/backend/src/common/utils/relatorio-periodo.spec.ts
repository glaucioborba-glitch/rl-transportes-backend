import { parseRelatorioInicioFim } from './relatorio-periodo';

describe('relatorio-periodo', () => {
  it('expande fim do dia em strings só-data (YYYY-MM-DD)', () => {
    const { ini, fim } = parseRelatorioInicioFim('2026-04-01', '2026-04-22');
    expect(ini.getHours()).toBe(0);
    expect(ini.getMinutes()).toBe(0);
    expect(fim.getHours()).toBe(23);
    expect(fim.getMinutes()).toBe(59);
    expect(ini.getFullYear()).toBe(2026);
    expect(fim.getFullYear()).toBe(2026);
  });
});
