import { montarBasicAuthIpm, montarMultipartIpm } from './ipm-multipart.util';

describe('montarMultipartIpm', () => {
  it('monta o campo File com charset ISO-8859-1', () => {
    const { body, contentType, boundary } = montarMultipartIpm('<nfse/>', 'nfse.xml', '----teste');
    const texto = body.toString('latin1');

    expect(contentType).toBe('multipart/form-data; boundary=----teste');
    expect(boundary).toBe('----teste');
    expect(texto).toContain('name="File"; filename="nfse.xml"');
    expect(texto).toContain('charset=ISO-8859-1');
    expect(texto).toContain('<nfse/>');
    expect(texto.endsWith('------teste--\r\n')).toBe(true);
  });

  it('grava acentos em latin1, como a prefeitura espera', () => {
    const { body } = montarMultipartIpm('<obs>Armazenagem de contêiner</obs>');
    expect(body.toString('latin1')).toContain('contêiner');
    expect(body.includes(Buffer.from('contêiner', 'latin1'))).toBe(true);
  });

  it('gera boundary diferente a cada envio', () => {
    expect(montarMultipartIpm('<a/>').boundary).not.toBe(montarMultipartIpm('<a/>').boundary);
  });
});

describe('montarBasicAuthIpm', () => {
  it('usa o CNPJ sem máscara como usuário', () => {
    const header = montarBasicAuthIpm('27.692.077/0001-26', 'senha-portal');
    const decodificado = Buffer.from(header.replace('Basic ', ''), 'base64').toString('utf8');
    expect(decodificado).toBe('27692077000126:senha-portal');
  });

  it('não quebra sem senha', () => {
    expect(montarBasicAuthIpm('27692077000126', '')).toMatch(/^Basic /);
  });
});
