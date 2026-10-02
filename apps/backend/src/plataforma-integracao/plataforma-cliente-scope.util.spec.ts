import { mergePlataformaClienteIds } from './plataforma-cliente-scope.util';

describe('mergePlataformaClienteIds', () => {
  it('sem ids na chave nem no tenant não libera o banco inteiro', () => {
    expect(mergePlataformaClienteIds(undefined, undefined)).toEqual([]);
    expect(mergePlataformaClienteIds([], [])).toEqual([]);
  });

  it('usa a interseção quando ambos têm lista', () => {
    expect(mergePlataformaClienteIds(['a', 'b'], ['b', 'c'])).toEqual(['b']);
  });

  it('restringe pela chave quando o tenant não lista clientes', () => {
    expect(mergePlataformaClienteIds([], ['a'])).toEqual(['a']);
  });
});
