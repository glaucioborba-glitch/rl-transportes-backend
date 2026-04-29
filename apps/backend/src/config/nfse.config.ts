import { registerAs } from '@nestjs/config';

/**
 * Integração IPM/Atende.Net (NFS-e) — município padrão Navegantes-SC.
 * Nunca logar `senha` ou Authorization em claro.
 */
export default registerAs('nfse', () => ({
  ipm: {
    baseUrl:
      process.env.NFSE_IPM_BASE_URL ||
      'https://ws-navegantes.atende.net:7443/?pg=rest&service=WNERestServiceNFSe',
    prestadorCnpj: process.env.NFSE_IPM_PRESTADOR_CNPJ || '27692077000126',
    prestadorTom: process.env.NFSE_IPM_PRESTADOR_TOM || '8221',
    /** Senha do portal (usuário = CNPJ do prestador). Obrigatória para transmitir. */
    senha: process.env.NFSE_IPM_SENHA || '',
    municipioIbge: process.env.NFSE_IPM_MUNICIPIO_IBGE || '4211306',
    /** Nome do elemento XML (filho de &lt;nf&gt;) com valor C no cancelamento (NTE-35/2021). Conferir no portal se rejeitado. */
    tagIndicadorCancelamento: (process.env.NFSE_IPM_TAG_CANCEL || 'tipo').replace(/[^a-zA-Z0-9_]/g, '') || 'tipo',
  },
}));
