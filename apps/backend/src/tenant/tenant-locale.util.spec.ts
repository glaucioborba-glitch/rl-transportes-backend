import { parseIdiomaPadrao, parseMoedaCorrente } from './tenant-locale.util';

describe('tenant-locale.util', () => {
  it('aceita moeda do tenant e cai em BRL se inválida', () => {
    expect(parseMoedaCorrente('USD')).toBe('USD');
    expect(parseMoedaCorrente('xxx')).toBe('BRL');
    expect(parseMoedaCorrente(undefined)).toBe('BRL');
  });

  it('aceita idioma do tenant e cai em pt-BR se inválido', () => {
    expect(parseIdiomaPadrao('en-US')).toBe('en-US');
    expect(parseIdiomaPadrao('es-ES')).toBe('es-ES');
    expect(parseIdiomaPadrao('fr-FR')).toBe('pt-BR');
  });
});
