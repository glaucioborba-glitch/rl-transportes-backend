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

  describe('CPF com tipo PF', () => {
    it('rejeita 14 dígitos quando tipo=PF com mensagem específica', () => {
      try {
        pipe.transform({
          tipo: 'PF',
          cpfCnpj: '12345678000195',
        });
        throw new Error('esperava exceção');
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect((e as BadRequestException).message).toContain('Pessoa Física');
        expect((e as BadRequestException).message).toContain('CPF');
      }
    });

    it('mensagem específica para tamanho errado com tipo PF', () => {
      try {
        pipe.transform({ tipo: 'PF', cpfCnpj: '123' });
        throw new Error('esperava exceção');
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect((e as BadRequestException).message).toContain('11 dígitos');
      }
    });
  });

  describe('Validações gerais', () => {
    it('retorna o objeto com cpfCnpj normalizado', () => {
      const b = { cpfCnpj: '529.982.247-25', nome: 'x' };
      const out = pipe.transform(b);
      expect(out).toBe(b);
      expect((out as { cpfCnpj: string }).cpfCnpj).toBe('52998224725');
    });

    it('não explode com cpfCnpj undefined/null sem tipo (DTO valida depois)', () => {
      expect(pipe.transform({ cpfCnpj: undefined })).toEqual({ cpfCnpj: undefined });
      expect(pipe.transform({ cpfCnpj: null })).toEqual({ cpfCnpj: null });
    });

    it('rejeita documento com mensagem genérica quando tamanho inválido', () => {
      try {
        pipe.transform({ cpfCnpj: '123' });
        throw new Error('esperava exceção');
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect((e as BadRequestException).message).toContain(
          'Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos',
        );
      }
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

  describe('CPF vazio / PJ sem CNPJ', () => {
    it('CPF vazio com tipo PF → 400', () => {
      expect(() => pipe.transform({ tipo: 'PF', cpfCnpj: '' })).toThrow(BadRequestException);
    });

    it('CPF undefined com tipo PF → 400', () => {
      expect(() => pipe.transform({ tipo: 'PF', cpfCnpj: undefined })).toThrow(BadRequestException);
    });

    it('CNPJ não informado com tipo PJ → 400', () => {
      expect(() => pipe.transform({ tipo: 'PJ', cpfCnpj: null })).toThrow(BadRequestException);
    });
  });
});
