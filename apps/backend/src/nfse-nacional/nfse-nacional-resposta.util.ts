import { gunzipSync } from 'node:zlib';
import { XMLParser } from 'fast-xml-parser';

export type RespostaNfseNacional = {
  sucesso: boolean;
  chaveAcesso?: string;
  numeroNfse?: string;
  dataProcessamento?: string;
  linkDanfse?: string;
  xmlNfse?: string;
  erros: string[];
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  removeNSPrefix: true,
});

function descomprimir(b64: unknown): string | undefined {
  const texto = typeof b64 === 'string' ? b64.replace(/\s+/g, '') : '';
  if (!texto) return undefined;
  try {
    return gunzipSync(Buffer.from(texto, 'base64')).toString('utf8');
  } catch {
    return undefined;
  }
}

function coletarErros(corpo: Record<string, unknown>): string[] {
  const erros: string[] = [];
  const push = (codigo: unknown, descricao: unknown) => {
    const texto = [codigo, descricao].filter(Boolean).join(' - ').trim();
    if (texto) erros.push(texto);
  };

  const lista = corpo.erros ?? corpo.Erros ?? corpo.alertas;
  if (Array.isArray(lista)) {
    for (const item of lista) {
      if (typeof item === 'string') erros.push(item);
      else if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        push(o.Codigo ?? o.codigo, o.Descricao ?? o.descricao ?? o.Mensagem ?? o.mensagem);
      }
    }
  }
  push(corpo.codigo ?? corpo.Codigo, corpo.mensagem ?? corpo.Mensagem ?? corpo.message);
  if (typeof corpo.title === 'string') erros.push(corpo.title);
  return erros;
}

/** Lê a chave e o número da NFS-e dentro do XML devolvido pelo Sefin. */
export function extrairDadosNfseXml(xml: string): {
  chaveAcesso?: string;
  numeroNfse?: string;
  dataProcessamento?: string;
} {
  try {
    const doc = parser.parse(xml) as Record<string, any>;
    const inf = doc?.NFSe?.infNFSe ?? doc?.nfseProc?.NFSe?.infNFSe ?? doc?.infNFSe;
    if (!inf) return {};
    return {
      chaveAcesso: inf['@_Id'] ? String(inf['@_Id']).replace(/^NFS?e?/i, '') : undefined,
      numeroNfse: inf.nNFSe != null ? String(inf.nNFSe) : undefined,
      dataProcessamento: inf.dhProc != null ? String(inf.dhProc) : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Normaliza a resposta do POST /nfse (e dos eventos): o XML da nota vem
 * comprimido em GZip/Base64 e os erros chegam em formatos diferentes.
 */
export function interpretarRespostaNfse(
  status: number,
  corpoBruto: string,
): RespostaNfseNacional {
  let corpo: Record<string, unknown> = {};
  try {
    corpo = corpoBruto ? (JSON.parse(corpoBruto) as Record<string, unknown>) : {};
  } catch {
    return {
      sucesso: false,
      erros: [corpoBruto?.slice(0, 300) || `HTTP ${status} sem corpo`],
    };
  }

  const xmlNfse =
    descomprimir(corpo.nfseXmlGZipB64) ??
    descomprimir((corpo as { NfseXmlGZipB64?: unknown }).NfseXmlGZipB64);
  const doXml = xmlNfse ? extrairDadosNfseXml(xmlNfse) : {};
  const chaveAcesso =
    (typeof corpo.chaveAcesso === 'string' ? corpo.chaveAcesso : undefined) ??
    (typeof (corpo as { ChaveAcesso?: unknown }).ChaveAcesso === 'string'
      ? ((corpo as { ChaveAcesso?: string }).ChaveAcesso as string)
      : undefined) ??
    doXml.chaveAcesso;

  const erros = coletarErros(corpo);
  const sucesso = status >= 200 && status < 300 && Boolean(chaveAcesso || xmlNfse);

  return {
    sucesso,
    chaveAcesso,
    numeroNfse: doXml.numeroNfse,
    dataProcessamento: doXml.dataProcessamento,
    linkDanfse: typeof corpo.linkDanfse === 'string' ? corpo.linkDanfse : undefined,
    xmlNfse,
    erros: sucesso ? [] : erros.length ? erros : [`HTTP ${status}`],
  };
}
