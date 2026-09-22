import * as forge from 'node-forge';
import { CertificadoA1Error, diasParaVencer, lerCertificadoA1 } from './certificado-a1.util';

/** Gera um PFX de teste no mesmo formato de um e-CNPJ A1 (CN "RAZAO:CNPJ"). */
function gerarPfxBase64(opts?: { senha?: string; cn?: string; diasValidade?: number }): string {
  const senha = opts?.senha ?? 'teste123';
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(
    Date.now() + (opts?.diasValidade ?? 365) * 86_400_000,
  );
  const attrs = [{ name: 'commonName', value: opts?.cn ?? 'RL TRANSPORTES LTDA:27692077000126' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], senha, {
    algorithm: '3des',
  });
  return forge.util.encode64(forge.asn1.toDer(p12).getBytes());
}

describe('lerCertificadoA1', () => {
  jest.setTimeout(30_000);

  it('extrai PEMs, titular e CNPJ do e-CNPJ', () => {
    const pfx = gerarPfxBase64();
    const cert = lerCertificadoA1(pfx, 'teste123');

    expect(cert.certificadoPem).toContain('BEGIN CERTIFICATE');
    expect(cert.chavePrivadaPem).toContain('PRIVATE KEY');
    expect(cert.documentoTitular).toBe('27692077000126');
    expect(cert.titular).toContain('RL TRANSPORTES');
    expect(cert.validoAte.getTime()).toBeGreaterThan(Date.now());
  });

  it('aceita base64 com quebras de linha', () => {
    const pfx = gerarPfxBase64();
    const quebrado = pfx.replace(/(.{64})/g, '$1\n');
    expect(() => lerCertificadoA1(quebrado, 'teste123')).not.toThrow();
  });

  it('avisa quando a senha está errada', () => {
    const pfx = gerarPfxBase64();
    expect(() => lerCertificadoA1(pfx, 'errada')).toThrow(CertificadoA1Error);
    expect(() => lerCertificadoA1(pfx, 'errada')).toThrow(/[Ss]enha/);
  });

  it('recusa conteúdo que não é certificado', () => {
    expect(() => lerCertificadoA1('bm9wZQ==', 'x')).toThrow(CertificadoA1Error);
    expect(() => lerCertificadoA1('', 'x')).toThrow(/não informado/);
  });

  it('calcula dias para vencer', () => {
    const cert = lerCertificadoA1(gerarPfxBase64({ diasValidade: 30 }), 'teste123');
    expect(diasParaVencer(cert)).toBeGreaterThanOrEqual(29);
    expect(diasParaVencer(cert, new Date(Date.now() + 40 * 86_400_000))).toBeLessThan(0);
  });
});
