import { CnabParserService } from './cnab-parser.service';
import { buildCnab240Line } from './cnab240-ailos.util';

describe('CnabParserService', () => {
  let parser: CnabParserService;

  beforeEach(() => {
    parser = new CnabParserService();
  });

  it('detecta CNAB 400 por comprimento de linha', () => {
    const linha400 = '0'.repeat(400);
    expect(parser.detectFormato(`${linha400}\n${linha400}`)).toBe('CNAB400');
  });

  it('detecta CNAB 240 Ailos por prefixo 085', () => {
    const linha = buildCnab240Line((w) => w(1, '08500000'));
    expect(parser.detectFormato(linha)).toBe('CNAB240');
  });

  it('parseCnab240 extrai liquidações Ailos', () => {
    const linhaT = buildCnab240Line((w) => {
      w(14, 'T');
      w(16, '06');
      w(38, '987654321');
    });
    const linhaU = buildCnab240Line((w) => {
      w(14, 'U');
      w(78, '000000000005000');
      w(138, '01012026');
    });

    const rows = parser.parseCnab240(`${linhaT}\n${linhaU}`);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.nossoNumero).toBe('987654321');
    expect(rows[0]!.valorPago).toBe(50);
  });

  it('parseRetorno integra detecção e parsing', () => {
    const linhaT = buildCnab240Line((w) => {
      w(1, '085');
      w(14, 'T');
      w(16, '06');
      w(38, '111');
    });
    const linhaU = buildCnab240Line((w) => {
      w(14, 'U');
      w(78, '000000000001000');
      w(138, '02022026');
    });

    const { formato, linhas } = parser.parseRetorno(`${linhaT}\n${linhaU}`);
    expect(formato).toBe('CNAB240');
    expect(linhas).toHaveLength(1);
  });
});
