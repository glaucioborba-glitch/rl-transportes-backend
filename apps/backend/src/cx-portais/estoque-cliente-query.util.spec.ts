import { estoqueClienteMatchesQuery } from './estoque-cliente-query.util';

describe('estoqueClienteMatchesQuery', () => {
  const row = {
    unidadeIso: 'MSKU1234567',
    numero: 1284,
    protocolo: 'OS-100',
    booking: 'BK-9',
    processo: 'PROC-1',
    navio: 'MAERSK LIMA',
  };

  it('lista tudo sem filtro', () => {
    expect(estoqueClienteMatchesQuery(row, '')).toBe(true);
  });

  it('acha pelo ISO com ou sem máscara', () => {
    expect(estoqueClienteMatchesQuery(row, 'MSKU 123456-7')).toBe(true);
    expect(estoqueClienteMatchesQuery(row, 'msku123')).toBe(true);
  });

  it('acha pelo ID sequencial', () => {
    expect(estoqueClienteMatchesQuery(row, '1284')).toBe(true);
  });

  it('não trata query só-letras como match de ID', () => {
    expect(
      estoqueClienteMatchesQuery({ ...row, protocolo: 'OS-100', booking: '', processo: '', navio: '' }, 'ZZZ'),
    ).toBe(false);
  });
});
