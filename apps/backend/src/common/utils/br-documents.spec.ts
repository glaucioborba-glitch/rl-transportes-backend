import { onlyDigits, validateCnpjDigits, validateCpfDigits } from './br-documents';

describe('br-documents', () => {
  it('onlyDigits remove máscara', () => {
    expect(onlyDigits('123.456.789-09')).toBe('12345678909');
  });

  it('valida CPF conhecido', () => {
    expect(validateCpfDigits('52998224725')).toBe(true);
  });

  it('rejeita CPF inválido', () => {
    expect(validateCpfDigits('11111111111')).toBe(false);
  });

  it('valida CNPJ conhecido', () => {
    expect(validateCnpjDigits('11222333000181')).toBe(true);
  });
});
