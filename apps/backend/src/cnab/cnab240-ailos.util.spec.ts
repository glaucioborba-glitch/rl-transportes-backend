import {
  buildCnab240Line,
  parseCnab240AilosRetorno,
  parseDataCnab240DdMmYyyy,
  parseValorCentavosCnab240,
} from './cnab240-ailos.util';

describe('cnab240-ailos.util', () => {
  it('parseValorCentavosCnab240 divide centavos', () => {
    expect(parseValorCentavosCnab240('000000000010000')).toBe(100);
    expect(parseValorCentavosCnab240('000000000001234')).toBe(12.34);
  });

  it('parseDataCnab240DdMmYyyy interpreta DDMMAAAA', () => {
    const d = parseDataCnab240DdMmYyyy('09062026');
    expect(d?.toISOString().slice(0, 10)).toBe('2026-06-09');
  });

  it('ignora headers 08500000 e 08500011', () => {
    const headerArquivo = buildCnab240Line((w) => w(1, '08500000'));
    const headerLote = buildCnab240Line((w) => w(1, '08500011'));
    const conteudo = [headerArquivo, headerLote].join('\n');
    expect(parseCnab240AilosRetorno(conteudo)).toEqual([]);
  });

  it('extrai liquidação código 06 com segmentos T e U', () => {
    const linhaT = buildCnab240Line((w) => {
      w(1, '085');
      w(14, 'T');
      w(16, '06');
      w(38, '00000000000012345');
    });

    const linhaU = buildCnab240Line((w) => {
      w(1, '085');
      w(14, 'U');
      w(78, '000000000010000');
      w(138, '15062026');
    });

    const conteudo = [linhaT, linhaU].join('\n');
    const rows = parseCnab240AilosRetorno(conteudo);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.nossoNumero).toBe('00000000000012345');
    expect(rows[0]!.valorPago).toBe(100);
    expect(rows[0]!.codigoMovimento).toBe('06');
    expect(rows[0]!.dataPagamento.toISOString().slice(0, 10)).toBe('2026-06-15');
  });

  it('ignora segmento T com código diferente de 06', () => {
    const linhaT = buildCnab240Line((w) => {
      w(14, 'T');
      w(16, '02');
      w(38, '12345');
    });
    const linhaU = buildCnab240Line((w) => {
      w(14, 'U');
      w(78, '000000000010000');
      w(138, '15062026');
    });

    expect(parseCnab240AilosRetorno(`${linhaT}\n${linhaU}`)).toEqual([]);
  });

  it('ignora T sem segmento U imediato', () => {
    const linhaT = buildCnab240Line((w) => {
      w(14, 'T');
      w(16, '06');
      w(38, '12345');
    });
    const linhaX = buildCnab240Line((w) => w(14, 'X'));

    expect(parseCnab240AilosRetorno(`${linhaT}\n${linhaX}`)).toEqual([]);
  });
});
