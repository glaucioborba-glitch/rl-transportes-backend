import { lacreEstoquePatio } from './saldo-patio-item.util';

describe('lacreEstoquePatio', () => {
  it('usa o lacre da RIC de entrada quando não houve troca', () => {
    expect(lacreEstoquePatio('CHEIO', ' ABC123 ', null)).toBe('ABC123');
  });

  it('coleta puxa o lacre de saída após troca no pátio', () => {
    expect(lacreEstoquePatio('CHEIO', 'CR0381735', 'LACREQA01')).toBe('LACREQA01');
  });

  it('não devolve lacre de unidade vazia', () => {
    expect(lacreEstoquePatio('VAZIO', 'ABC', 'NEW')).toBeNull();
  });
});
