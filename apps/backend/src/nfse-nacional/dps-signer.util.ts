import { gzipSync } from 'node:zlib';
import { SignedXml } from 'xml-crypto';
import type { CertificadoA1 } from './certificado-a1.util';

/**
 * Assinatura XMLDSig do padrão nacional: enveloped + C14N, SHA-256,
 * referência ao atributo Id do elemento (infDPS ou infEvento).
 */
export function assinarXmlNacional(
  xml: string,
  id: string,
  certificado: Pick<CertificadoA1, 'certificadoPem' | 'chavePrivadaPem'>,
  elementoPai: 'infDPS' | 'infEvento' = 'infDPS',
): string {
  const sig = new SignedXml({
    privateKey: certificado.chavePrivadaPem,
    publicCert: certificado.certificadoPem,
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    getKeyInfoContent: () =>
      `<X509Data><X509Certificate>${certificado.certificadoPem
        .replace(/-----(BEGIN|END) CERTIFICATE-----/g, '')
        .replace(/\s+/g, '')}</X509Certificate></X509Data>`,
  });

  sig.addReference({
    xpath: `//*[local-name(.)='${elementoPai}']`,
    uri: `#${id}`,
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    ],
  });

  // A assinatura entra como irmã de infDPS/infEvento, dentro do elemento raiz.
  sig.computeSignature(xml, {
    location: { reference: `//*[local-name(.)='${elementoPai}']`, action: 'after' },
  });

  return sig.getSignedXml();
}

/** O Sefin recebe o XML assinado comprimido em GZip e codificado em Base64. */
export function comprimirParaEnvio(xmlAssinado: string): string {
  return gzipSync(Buffer.from(xmlAssinado, 'utf8')).toString('base64');
}
