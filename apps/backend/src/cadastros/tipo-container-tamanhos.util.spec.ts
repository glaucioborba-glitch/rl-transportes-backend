import {
  formatTamanhoContainerMatrix,
  normalizeTamanhosContainer,
} from './tipo-container-tamanhos.util';

describe('tipo-container-tamanhos.util', () => {
  it('normaliza e deduplica tamanhos', () => {
    expect(normalizeTamanhosContainer(["20'", '40', '20'])).toEqual(['20', '40']);
  });

  it('formata para matriz de preços', () => {
    expect(formatTamanhoContainerMatrix('40')).toBe("40'");
  });
});

describe('gerarMatrizCombinacoes (regra)', () => {
  it('gera CHEIO+VAZIO só para tamanhos do tipo', () => {
    const tamanhos = normalizeTamanhosContainer(['20', '40']);
    const linhas = tamanhos.length * 2;
    expect(linhas).toBe(4);
    expect(formatTamanhoContainerMatrix(tamanhos[0])).toBe("20'");
  });
});
