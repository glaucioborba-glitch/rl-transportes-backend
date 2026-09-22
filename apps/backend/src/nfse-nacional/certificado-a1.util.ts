import * as forge from 'node-forge';

export type CertificadoA1 = {
  /** Certificado do titular em PEM (usado no mTLS e no KeyInfo da assinatura). */
  certificadoPem: string;
  /** Chave privada em PEM. */
  chavePrivadaPem: string;
  /** Cadeia adicional (intermediárias da ICP-Brasil), quando vier no PFX. */
  cadeiaPem: string[];
  /** CNPJ/CPF extraído do titular, quando presente no CN (formato "NOME:14dígitos"). */
  documentoTitular?: string;
  titular: string;
  validoDe: Date;
  validoAte: Date;
};

export class CertificadoA1Error extends Error {}

function pemDoCertificado(cert: forge.pki.Certificate): string {
  return forge.pki.certificateToPem(cert);
}

/** O CN do e-CNPJ ICP-Brasil vem como "RAZAO SOCIAL:00000000000000". */
function extrairDocumento(cn: string): string | undefined {
  const m = cn.match(/:(\d{11,14})\s*$/);
  return m ? m[1] : undefined;
}

/**
 * Abre o PFX/P12 (base64) do titular e devolve as partes em PEM.
 * O certificado é a chave de acesso da integração: mTLS + assinatura da DPS.
 */
export function lerCertificadoA1(pfxBase64: string, senha: string): CertificadoA1 {
  const limpo = (pfxBase64 ?? '').replace(/\s+/g, '');
  if (!limpo) throw new CertificadoA1Error('Certificado A1 não informado.');

  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    const der = forge.util.decode64(limpo);
    const asn1 = forge.asn1.fromDer(der);
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha ?? '');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new CertificadoA1Error(
      /mac|password|invalid password/i.test(msg)
        ? 'Senha do certificado incorreta.'
        : `Certificado A1 inválido: ${msg}`,
    );
  }

  const bagsChave =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ??
    [];
  const bagsChaveSimples = p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? [];
  const chave = [...bagsChave, ...bagsChaveSimples].find((b) => b.key)?.key;
  if (!chave) throw new CertificadoA1Error('Certificado A1 sem chave privada utilizável.');

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  const certificados = certBags.map((b) => b.cert).filter((c): c is forge.pki.Certificate => Boolean(c));
  if (!certificados.length) throw new CertificadoA1Error('Certificado A1 sem certificado do titular.');

  // O titular é o único cujo par de chaves bate com a chave privada do arquivo.
  const publicaDaChave = forge.pki.publicKeyToPem(
    forge.pki.setRsaPublicKey((chave as forge.pki.rsa.PrivateKey).n, (chave as forge.pki.rsa.PrivateKey).e),
  );
  const titular =
    certificados.find((c) => forge.pki.publicKeyToPem(c.publicKey) === publicaDaChave) ?? certificados[0];
  const cadeia = certificados.filter((c) => c !== titular);

  const cn = titular.subject.getField('CN')?.value ?? '';
  return {
    certificadoPem: pemDoCertificado(titular),
    chavePrivadaPem: forge.pki.privateKeyToPem(chave as forge.pki.rsa.PrivateKey),
    cadeiaPem: cadeia.map(pemDoCertificado),
    documentoTitular: extrairDocumento(cn),
    titular: cn,
    validoDe: titular.validity.notBefore,
    validoAte: titular.validity.notAfter,
  };
}

/** Dias que faltam para o certificado vencer (negativo = já venceu). */
export function diasParaVencer(cert: Pick<CertificadoA1, 'validoAte'>, agora = new Date()): number {
  return Math.floor((cert.validoAte.getTime() - agora.getTime()) / 86_400_000);
}
