import { parseOptionalPlacaPreferencial } from './motorista-placas-preferenciais.util';

describe('parseOptionalPlacaPreferencial', () => {
  it('aceita vazio', () => {
    expect(parseOptionalPlacaPreferencial('')).toEqual({ ok: true, placa: null });
    expect(parseOptionalPlacaPreferencial('  ')).toEqual({ ok: true, placa: null });
    expect(parseOptionalPlacaPreferencial(undefined)).toEqual({ ok: true, placa: null });
  });

  it('normaliza Mercosul e formato antigo', () => {
    expect(parseOptionalPlacaPreferencial('abc-1d23')).toEqual({ ok: true, placa: 'ABC1D23' });
    expect(parseOptionalPlacaPreferencial('abc1234')).toEqual({ ok: true, placa: 'ABC1234' });
    expect(parseOptionalPlacaPreferencial('ABCD1D34')).toEqual({ ok: true, placa: 'ABCD1D34' });
  });

  it('rejeita placa inválida', () => {
    expect(parseOptionalPlacaPreferencial('123')).toEqual({ ok: false });
    expect(parseOptionalPlacaPreferencial('ABCDEFG')).toEqual({ ok: false });
  });
});
