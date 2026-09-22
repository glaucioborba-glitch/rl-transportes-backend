import { randomBytes } from 'node:crypto';

/** Nome do campo multipart exigido pelo NTE-35/2021 (Postman: form-data, tipo File). */
export const IPM_MULTIPART_FIELD = 'File';

export type CorpoMultipart = {
  boundary: string;
  contentType: string;
  body: Buffer;
};

/**
 * Monta o multipart/form-data com o XML do IPM em ISO-8859-1.
 * Feito à mão porque o envio usa https.request (mTLS com certificado do terminal).
 */
export function montarMultipartIpm(
  xml: string,
  nomeArquivo = 'nfse.xml',
  boundary = `----RLTerminal${randomBytes(8).toString('hex')}`,
): CorpoMultipart {
  const cabecalho = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${IPM_MULTIPART_FIELD}"; filename="${nomeArquivo}"\r\n` +
      `Content-Type: text/xml; charset=ISO-8859-1\r\n\r\n`,
    'utf8',
  );
  const conteudo = Buffer.from(xml, 'latin1');
  const rodape = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');

  return {
    boundary,
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: Buffer.concat([cabecalho, conteudo, rodape]),
  };
}

/** Basic auth do portal: usuário é o CNPJ do prestador. */
export function montarBasicAuthIpm(cnpj: string, senha: string): string {
  const usuario = (cnpj ?? '').replace(/\D/g, '');
  return `Basic ${Buffer.from(`${usuario}:${senha ?? ''}`, 'utf8').toString('base64')}`;
}
