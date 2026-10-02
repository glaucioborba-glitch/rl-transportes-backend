export type AmbienteNfseNacional = 'homologacao' | 'producao';

export type EndpointsNfseNacional = {
  /** Emissão, consulta por chave e eventos. */
  sefin: string;
  /** Distribuição de DF-e do contribuinte. */
  adnContribuintes: string;
  /** PDF do DANFSe. */
  danfse: string;
  /** tpAmb da DPS: 1 = produção, 2 = produção restrita. */
  tpAmb: 1 | 2;
};

/**
 * Ambientes oficiais do Sistema Nacional NFS-e (gov.br).
 * Produção restrita é o ambiente de homologação: a nota não tem valor jurídico.
 */
export const ENDPOINTS_NFSE_NACIONAL: Record<AmbienteNfseNacional, EndpointsNfseNacional> = {
  homologacao: {
    sefin: 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional',
    adnContribuintes: 'https://adn.producaorestrita.nfse.gov.br/contribuintes',
    danfse: 'https://adn.producaorestrita.nfse.gov.br/danfse',
    tpAmb: 2,
  },
  producao: {
    sefin: 'https://sefin.nfse.gov.br/SefinNacional',
    adnContribuintes: 'https://adn.nfse.gov.br/contribuintes',
    danfse: 'https://adn.nfse.gov.br/danfse',
    tpAmb: 1,
  },
};

export function normalizarAmbiente(raw: unknown): AmbienteNfseNacional {
  return String(raw ?? '').trim().toLowerCase() === 'producao' ? 'producao' : 'homologacao';
}

/** Enviar tpAmb trocado em relação ao host é rejeitado pelo Sefin (E0006). */
export function resolverEndpoints(ambiente: unknown): EndpointsNfseNacional {
  return ENDPOINTS_NFSE_NACIONAL[normalizarAmbiente(ambiente)];
}
