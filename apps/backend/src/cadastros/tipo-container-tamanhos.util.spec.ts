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

  it('resolve aliases legados para códigos MDM', () => {
    const catalog = ['DRYDC', 'DRYHC', 'REEFER', 'OPENTOP', 'FLATRACK', 'ISOTANK'];
    expect(resolveTipoContainerCodigo('DRY', catalog)).toBe('DRYDC');
    expect(resolveTipoContainerCodigo('HC', catalog)).toBe('DRYHC');
    expect(resolveTipoContainerCodigo('DRYDC', catalog)).toBe('DRYDC');
    expect(resolveTipoContainerCodigo('OT', catalog)).toBe('OPENTOP');
  });

  it('formata para matriz de preços', () => {
    expect(formatTamanhoContainerMatrix('40')).toBe("40'");
    expect(formatTamanhoContainerMatrix('20DC')).toBe("20'");
  });

  it("monta label padrão DRYDC / 20'", () => {
    expect(formatTipoTamanhoContainerLabel('dry', '20DC')).toBe("DRYDC / 20'");
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
