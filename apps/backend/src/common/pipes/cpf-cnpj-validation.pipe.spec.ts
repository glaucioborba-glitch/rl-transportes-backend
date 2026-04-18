import { BadRequestException } from '@nestjs/common';
import { CpfCnpjValidationPipe } from './cpf-cnpj-validation.pipe';

describe('CpfCnpjValidationPipe', () => {
  const pipe = new CpfCnpjValidationPipe();

  describe('CPF válido', () => {
    it('aceita CPF válido (11 dígitos)', () => {
      const b = { cpfCnpj: '11144477735' };
      expect(pipe.transform(b)).toBe(b);
      expect(b.cpfCnpj).toBe('11144477735');
    });

    it('aceita CPF formatado e remove caracteres', () => {
      const b = { cpfCnpj: '111.444.777-35' };
      pipe.transform(b);
      expect(b.cpfCnpj).toBe('11144477735');
    });

    it('rejeita CPF com dígito verificador incorreto', () => {
      expect(() => pipe.transform({ cpfCnpj: '11144477736' })).toThrow(BadRequestException);
    });

    it('rejeita CPF com sequência igual (11111111111)', () => {
      expect(() => pipe.transform({ cpfCnpj: '11111111111' })).toThrow(BadRequestException);
    });
  });

  describe('CNPJ válido', () => {
    it('aceita CNPJ válido (14 dígitos)', () => {
      const b = { cpfCnpj: '12345678000195' };
      pipe.transform(b);
      expect(b.cpfCnpj).toBe('12345678000195');
    });

    it('aceita CNPJ formatado e remove caracteres', () => {
      const b = { cpfCnpj: '12.345.678/0001-95' };
      pipe.transform(b);
      expect(b.cpfCnpj).toBe('12345678000195');
    });

    it('rejeita CNPJ com dígito verificador incorreto', () => {
      expect(() => pipe.transform({ cpfCnpj: '12345678000196' })).toThrow(BadRequestException);
    });

    it('rejeita CNPJ com sequência igual', () => {
      expect(() =>
        pipe.transform({ cpfCnpj: '11111111111111' }),
      ).toThrow(BadRequestException);
    });
  });

  describe('Validações gerais', () => {
    it('retorna o objeto com cpfCnpj normalizado', () => {
      const b = { cpfCnpj: '529.982.247-25', nome: 'x' };
      const out = pipe.transform(b);
      expect(out).toBe(b);
      expect((out as { cpfCnpj: string }).cpfCnpj).toBe('52998224725');
    });

    it('rejeita documento com menos de 11 dígitos', () => {
      expect(() => pipe.transform({ cpfCnpj: '123456789' })).toThrow(BadRequestException);
    });

    it('rejeita documento com mais de 14 dígitos', () => {
      expect(() =>
        pipe.transform({ cpfCnpj: '123456789012345' }),
      ).toThrow(BadRequestException);
    });
  });
});
