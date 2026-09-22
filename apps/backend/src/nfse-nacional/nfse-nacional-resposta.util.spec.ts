import { gzipSync } from 'node:zlib';
import { extrairDadosNfseXml, interpretarRespostaNfse } from './nfse-nacional-resposta.util';

const CHAVE = '4'.repeat(50);

function nfseXml(chave = CHAVE): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">` +
    `<infNFSe Id="NFS${chave}"><nNFSe>123</nNFSe><dhProc>2026-09-21T12:30:00-03:00</dhProc></infNFSe>` +
    `</NFSe>`
  );
}

function comprimido(xml: string): string {
  return gzipSync(Buffer.from(xml, 'utf8')).toString('base64');
}

describe('interpretarRespostaNfse', () => {
  it('lê chave, número e XML da emissão aceita', () => {
    const r = interpretarRespostaNfse(
      201,
      JSON.stringify({ chaveAcesso: CHAVE, nfseXmlGZipB64: comprimido(nfseXml()) }),
    );
    expect(r.sucesso).toBe(true);
    expect(r.chaveAcesso).toBe(CHAVE);
    expect(r.numeroNfse).toBe('123');
    expect(r.dataProcessamento).toBe('2026-09-21T12:30:00-03:00');
    expect(r.xmlNfse).toContain('<infNFSe');
    expect(r.erros).toEqual([]);
  });

  it('recupera a chave do XML quando o JSON não traz', () => {
    const r = interpretarRespostaNfse(200, JSON.stringify({ nfseXmlGZipB64: comprimido(nfseXml()) }));
    expect(r.sucesso).toBe(true);
    expect(r.chaveAcesso).toBe(CHAVE);
  });

  it('junta os erros de validação da DPS', () => {
    const r = interpretarRespostaNfse(
      400,
      JSON.stringify({
        erros: [
          { Codigo: 'E0006', Descricao: 'Ambiente informado difere do endpoint' },
          { codigo: 'E0084', mensagem: 'Contribuinte não habilitado' },
        ],
      }),
    );
    expect(r.sucesso).toBe(false);
    expect(r.erros).toEqual([
      'E0006 - Ambiente informado difere do endpoint',
      'E0084 - Contribuinte não habilitado',
    ]);
  });

  it('não quebra com corpo que não é JSON', () => {
    const r = interpretarRespostaNfse(502, '<html>Bad Gateway</html>');
    expect(r.sucesso).toBe(false);
    expect(r.erros[0]).toContain('Bad Gateway');
  });

  it('marca falha quando 200 vem sem nota', () => {
    const r = interpretarRespostaNfse(200, JSON.stringify({}));
    expect(r.sucesso).toBe(false);
    expect(r.erros).toEqual(['HTTP 200']);
  });
});

describe('extrairDadosNfseXml', () => {
  it('ignora XML inválido sem lançar', () => {
    expect(extrairDadosNfseXml('não é xml')).toEqual({});
  });
});
