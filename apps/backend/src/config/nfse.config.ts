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
    certPath: process.env.NFSE_IPM_CERT_PATH || '',
    certPass: process.env.NFSE_IPM_CERT_PASS || '',
    tagIndicadorCancelamento: (process.env.NFSE_IPM_TAG_CANCEL || 'tipo').replace(/[^a-zA-Z0-9_]/g, '') || 'tipo',
    armazenagem: {
      codigoLocalPrestacao: process.env.NFSE_ARM_CODIGO_LOCAL || '8221',
      codigoAtividade: process.env.NFSE_ARM_CODIGO_ATIVIDADE || '4930201',
      codigoItemListaServico: process.env.NFSE_ARM_CODIGO_ITEM || '160201',
      aliquotaPercent: Number(process.env.NFSE_ARM_ALIQUOTA ?? '2') || 2,
      situacaoTributaria: process.env.NFSE_ARM_SIT_TRIB || '0',
    },
    tomadorTomFallback: process.env.NFSE_TOMADOR_TOM_FALLBACK || '8221',
  },
}));
