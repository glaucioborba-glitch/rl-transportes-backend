import { normalizarAmbiente, resolverEndpoints } from './nfse-nacional-endpoints.util';

describe('endpoints NFS-e Nacional', () => {
  it('homologação aponta para produção restrita com tpAmb 2', () => {
    const e = resolverEndpoints('homologacao');
    expect(e.sefin).toBe('https://sefin.producaorestrita.nfse.gov.br/SefinNacional');
    expect(e.tpAmb).toBe(2);
  });

  it('produção aponta para o Sefin nacional com tpAmb 1', () => {
    const e = resolverEndpoints('producao');
    expect(e.sefin).toBe('https://sefin.nfse.gov.br/SefinNacional');
    expect(e.danfse).toBe('https://adn.nfse.gov.br/danfse');
    expect(e.tpAmb).toBe(1);
  });

  it('valor desconhecido cai em homologação (nunca emite de verdade por engano)', () => {
    expect(normalizarAmbiente(undefined)).toBe('homologacao');
    expect(normalizarAmbiente('PRODUCAO_TESTE')).toBe('homologacao');
    expect(normalizarAmbiente(' Producao ')).toBe('producao');
  });
});
