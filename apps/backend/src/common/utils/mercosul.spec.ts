import { isValidPlacaMercosulOuAntiga } from './mercosul';

describe('mercosul', () => {
  it('aceita Mercosul sem hífen', () => {
    expect(isValidPlacaMercosulOuAntiga('ABC1D23')).toBe(true);
  });

  it('aceita formato antigo', () => {
    expect(isValidPlacaMercosulOuAntiga('ABC1234')).toBe(true);
  });

  it('rejeita vazio', () => {
    expect(isValidPlacaMercosulOuAntiga('')).toBe(false);
  });
});
