import { formatContabil, formatMoeda } from './format-moeda.util';

describe('formatMoeda', () => {
  it('usa símbolo + número contábil pt-BR', () => {
    expect(formatContabil(1550.32)).toBe('1.550,32');
    expect(formatMoeda(1550.32)).toBe('R$ 1.550,32');
    expect(formatMoeda(1550.32, 'USD')).toBe('US$ 1.550,32');
  });
});
