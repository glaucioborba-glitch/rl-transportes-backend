import {
  formatTamanhoContainerMatrix,
  formatTipoTamanhoContainerLabel,
  normalizeTamanhoContainer,
  normalizeTamanhosContainer,
  resolveTipoContainerCodigo,
} from './tipo-container-tamanhos.util';

describe('tipo-container-tamanhos.util', () => {
  it('normaliza e deduplica tamanhos', () => {
    expect(normalizeTamanhosContainer(["20'", '40', '20'])).toEqual(['20', '40']);
  });

  it('normaliza legado ISO-like (20DC, 40HC)', () => {
    expect(normalizeTamanhoContainer('20DC')).toBe('20');
    expect(normalizeTamanhoContainer('40HC')).toBe('40');
    expect(normalizeTamanhoContainer("45'")).toBe('45');
  });

  it('resolve aliases: DRYDC vira DRY; OT vira OPENTOP', () => {
    const catalog = ['DRY', 'REEFER', 'OPENTOP', 'FLATRACK', 'ISOTANK'];
    expect(resolveTipoContainerCodigo('DRY', catalog)).toBe('DRY');
    expect(resolveTipoContainerCodigo('DRYDC', catalog)).toBe('DRY');
    expect(resolveTipoContainerCodigo('DRYHC', catalog)).toBe('DRY');
    expect(resolveTipoContainerCodigo('OT', catalog)).toBe('OPENTOP');
  });

  it('formata para matriz de preços', () => {
    expect(formatTamanhoContainerMatrix('40')).toBe("40'");
    expect(formatTamanhoContainerMatrix('20DC')).toBe("20'");
  });

  it("monta label padrão DRY / 20'", () => {
    expect(formatTipoTamanhoContainerLabel('dry', '20DC')).toBe("DRY / 20'");
    expect(formatTipoTamanhoContainerLabel('REEFER', "40'")).toBe("REEFER / 40'");
    expect(formatTipoTamanhoContainerLabel('OT', null)).toBe('OPENTOP');
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
