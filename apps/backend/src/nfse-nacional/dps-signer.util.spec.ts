import { gunzipSync } from 'node:zlib';
import * as forge from 'node-forge';
import { lerCertificadoA1 } from './certificado-a1.util';
import { construirDpsXml, type DpsInput } from './dps-xml.builder';
import { assinarXmlNacional, comprimirParaEnvio } from './dps-signer.util';

function gerarPfxBase64(senha: string): string {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 365 * 86_400_000);
  const attrs = [{ name: 'commonName', value: 'RL TRANSPORTES LTDA:27692077000126' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], senha, { algorithm: '3des' });
  return forge.util.encode64(forge.asn1.toDer(p12).getBytes());
}

const DPS: DpsInput = {
  tpAmb: 2,
  serie: '1',
  numero: 1,
  emitidaEm: new Date('2026-09-21T15:30:00.000Z'),
  versaoAplicativo: 'RLTerminal-2.0',
  prestador: {
    cnpj: '27692077000126',
    municipioIbge: '4211306',
    optanteSimplesNacional: 3,
    regimeEspecialTributacao: 0,
  },
  tomador: { documento: '19131243000197', nome: 'Cliente QA' },
  servico: {
    municipioPrestacaoIbge: '4211306',
    codigoTributacaoNacional: '110101',
    descricao: 'Armazenagem',
    valor: 100,
    aliquotaIssPercent: 2,
  },
};

describe('assinarXmlNacional', () => {
  jest.setTimeout(30_000);

  const certificado = lerCertificadoA1(gerarPfxBase64('teste123'), 'teste123');

  it('assina a DPS com SHA-256 referenciando o Id', () => {
    const { xml, id } = construirDpsXml(DPS);
    const assinado = assinarXmlNacional(xml, id, certificado);

    expect(assinado).toContain('<Signature');
    expect(assinado).toContain(`URI="#${id}"`);
    expect(assinado).toContain('rsa-sha256');
    expect(assinado).toContain('xmlenc#sha256');
    expect(assinado).toContain('<X509Certificate>');
  });

  it('mantém a assinatura dentro do elemento DPS, após infDPS', () => {
    const { xml, id } = construirDpsXml(DPS);
    const assinado = assinarXmlNacional(xml, id, certificado);
    expect(assinado.indexOf('</infDPS>')).toBeLessThan(assinado.indexOf('<Signature'));
    expect(assinado.trimEnd().endsWith('</DPS>')).toBe(true);
  });

  it('comprime em gzip+base64 e volta ao XML original', () => {
    const { xml, id } = construirDpsXml(DPS);
    const assinado = assinarXmlNacional(xml, id, certificado);
    const b64 = comprimirParaEnvio(assinado);

    expect(b64).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(gunzipSync(Buffer.from(b64, 'base64')).toString('utf8')).toBe(assinado);
  });
});
