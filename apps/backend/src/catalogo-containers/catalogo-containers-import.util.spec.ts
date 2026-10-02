import {
  buildCatalogoImportModeloXls,
  mapCatalogoImportHeaders,
  parseCatalogoImportBuffer,
  parseCatalogoImportRows,
} from './catalogo-containers-import.util';

describe('catalogo-containers-import.util', () => {
  it('reconhece cabecalhos em portugues e aliases', () => {
    const map = mapCatalogoImportHeaders(['ISO', 'Tipo', 'Tamanho', 'Tara', 'MGW', 'Payload']);
    expect(map.unidadeIso).toBe(0);
    expect(map.tipoCodigo).toBe(1);
    expect(map.tamanhoPes).toBe(2);
    expect(map.taraKg).toBe(3);
    expect(map.mgwKg).toBe(4);
    expect(map.payloadKg).toBe(5);
  });

  it('grava DRY como tipo e DC/HC como capacidade', () => {
    const r = parseCatalogoImportRows([
      ['unidade_iso', 'tipo', 'tamanho', 'capacidade', 'tara_kg', 'mgw_kg', 'payload_kg'],
      ['SEGU 625416-7', 'DRY', '40', 'DC', '3.880', '32500', '28620'],
    ]);
    expect(r.erros).toHaveLength(0);
    expect(r.linhas[0]).toMatchObject({
      unidadeIso: 'SEGU6254167',
      tipoCodigo: 'DRY',
      tamanhoPes: '40',
      perfil: 'DC',
      taraKg: 3880,
      mgwKg: 32500,
      payloadKg: 28620,
    });
  });

  it('separa DRYDC/DRYHC da planilha antiga', () => {
    const r = parseCatalogoImportRows([
      ['iso', 'tipo', 'tamanho'],
      ['SEGU6254167', 'DRYHC', '40'],
    ]);
    expect(r.linhas[0]).toMatchObject({ tipoCodigo: 'DRY', tamanhoPes: '40', perfil: 'HC' });
  });

  it('rejeita ISO curto e ignora linha vazia', () => {
    const r = parseCatalogoImportRows([
      ['ISO', 'tara_kg'],
      ['ABC123', '3800'],
      ['', ''],
    ]);
    expect(r.linhas).toHaveLength(0);
    expect(r.erros).toHaveLength(1);
    expect(r.erros[0].motivo).toMatch(/11 caracteres/);
  });

  it('fica com a ultima linha quando o ISO se repete', () => {
    const r = parseCatalogoImportRows([
      ['iso', 'tara_kg'],
      ['SEGU6254167', '3800'],
      ['SEGU6254167', '3880'],
    ]);
    expect(r.duplicadosNaPlanilha).toBe(1);
    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0].taraKg).toBe(3880);
  });

  it('aceita capacidade DC/HC opcional', () => {
    const r = parseCatalogoImportRows([
      ['iso', 'tipo', 'tamanho', 'capacidade'],
      ['SEGU6254167', 'REEFER', '40', 'hc'],
    ]);
    expect(r.erros).toHaveLength(0);
    expect(r.linhas[0]?.perfil).toBe('HC');
  });

  it('gera modelo .xls que o parser relê', () => {
    const buf = buildCatalogoImportModeloXls();
    const r = parseCatalogoImportBuffer(buf);
    expect(r.erros).toHaveLength(0);
    expect(r.linhas[0]?.unidadeIso).toBe('SEGU6254167');
    expect(r.linhas[0]?.tipoCodigo).toBe('REEFER');
    expect(r.linhas[0]?.tamanhoPes).toBe('40');
    expect(r.linhas[0]?.perfil).toBe('HC');
  });
});
