import {
  buildCatalogoNaviosModeloXls,
  parseCatalogoNaviosBuffer,
  parseCatalogoNaviosRows,
} from './catalogo-navios-import.util';

describe('catalogo-navios-import.util', () => {
  it('reconhece a coluna Nome do Navio e ignora duplicata na planilha', () => {
    const r = parseCatalogoNaviosRows([
      ['Nome do Navio'],
      ['MSC Shay'],
      ['msc  shay'],
      ['APL PARIS'],
    ]);
    expect(r.erros).toHaveLength(0);
    expect(r.duplicadosNaPlanilha).toBe(1);
    expect(r.linhas.map((l) => l.nome).sort()).toEqual(['APL PARIS', 'MSC SHAY']);
  });

  it('gera modelo .xls legível', () => {
    const buf = buildCatalogoNaviosModeloXls();
    const parsed = parseCatalogoNaviosBuffer(buf);
    expect(parsed.linhas[0]?.nome).toBe('MSC SABRINA');
  });
});
