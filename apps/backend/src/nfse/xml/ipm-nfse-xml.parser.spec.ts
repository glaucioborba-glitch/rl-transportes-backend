import { parseIpmNfseXmlRetorno } from './ipm-nfse-xml.parser';

describe('ipm-nfse-xml.parser', () => {
  it('faz parse de retorno de sucesso (reduzido) com nota 430', () => {
    const raw = `<?xml version="1.0" encoding="ISO-8859-1"?>
<nfse>
  <nf>
    <numero_nfse>430</numero_nfse>
    <serie_nfse>1</serie_nfse>
    <situacao_codigo_nfse>1</situacao_codigo_nfse>
    <situacao_descricao_nfse>Emitida</situacao_descricao_nfse>
    <link_nfse>https://nfse-navegantes.atende.net/x</link_nfse>
    <cod_verificador_autenticidade>abc123</cod_verificador_autenticidade>
    <chave_acesso_nfse_nacional>4211</chave_acesso_nfse_nacional>
  </nf>
  <mensagem>
    <erro>[1] Sucesso</erro>
  </mensagem>
</nfse>`;
    const r = parseIpmNfseXmlRetorno(raw, 'emissao');
    expect(r.sucesso).toBe(true);
    expect(r.emissao?.numeroNfse).toBe('430');
    expect(r.emissao?.codVerificadorAutenticidade).toBe('abc123');
  });

  it('faz parse de erro de validação', () => {
    const raw = `<?xml version="1.0" encoding="UTF-8"?>
<nfse>
  <mensagem>
    <erro>[00132] Usuário ou Senha inválidos</erro>
  </mensagem>
</nfse>`;
    const r = parseIpmNfseXmlRetorno(raw, 'emissao');
    expect(r.sucesso).toBe(false);
    expect(r.erros[0]).toMatch(/00132/);
  });
});
