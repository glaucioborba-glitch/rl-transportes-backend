import { formatNavioNome, normalizeNavioNome, parseNavioNome } from './catalogo-navios.util';

describe('catalogo-navios.util', () => {
  it('normaliza acento, caixa e espaços para a chave única', () => {
    expect(normalizeNavioNome('  msc  sabrina ')).toBe('MSC SABRINA');
    expect(normalizeNavioNome('São Paulo Express')).toBe('SAO PAULO EXPRESS');
    expect(formatNavioNome('  log-in  experience ')).toBe('LOG-IN EXPERIENCE');
  });

  it('rejeita nome curto e aceita o mínimo', () => {
    expect(parseNavioNome('A')).toBeNull();
    expect(parseNavioNome('  ')).toBeNull();
    expect(parseNavioNome('MSC')).toEqual({ nome: 'MSC', nomeNorm: 'MSC' });
  });
});
