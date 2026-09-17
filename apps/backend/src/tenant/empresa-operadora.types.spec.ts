import { mergeEmpresaOperadora } from './empresa-operadora.types';

describe('mergeEmpresaOperadora moeda', () => {
  it('usa BRL quando a moeda não veio no cadastro', () => {
    expect(mergeEmpresaOperadora({ razaoSocial: 'RL' }).moedaCorrente).toBe('BRL');
  });

  it('aceita moeda válida', () => {
    expect(mergeEmpresaOperadora({ moedaCorrente: 'USD' }).moedaCorrente).toBe('USD');
  });

  it('ignora código inválido', () => {
    expect(mergeEmpresaOperadora({ moedaCorrente: 'XXX' as never }).moedaCorrente).toBe('BRL');
  });
});
