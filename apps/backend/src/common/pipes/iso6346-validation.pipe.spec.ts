import { BadRequestException } from '@nestjs/common';
import { Iso6346ValidationPipe } from './iso6346-validation.pipe';

describe('Iso6346ValidationPipe', () => {
  const pipe = new Iso6346ValidationPipe();

  describe('ISO 6346 válido', () => {
    it('aceita ISO válido (TEMU6079348)', () => {
      const b = { numeroIso: 'TEMU6079348' };
      expect(pipe.transform(b)).toBe(b);
      expect(b.numeroIso).toBe('TEMU6079348');
    });

    it('converte para UPPERCASE', () => {
      const b = { numeroIso: 'temu6079348' };
      pipe.transform(b);
      expect(b.numeroIso).toBe('TEMU6079348');
    });

    it('rejeita ISO com check digit inválido', () => {
      expect(() => pipe.transform({ numeroIso: 'TEMU6079349' })).toThrow(BadRequestException);
    });
  });

  describe('Validações', () => {
    it('rejeita comprimento inválido', () => {
      expect(() => pipe.transform({ numeroIso: 'TEMU60793' })).toThrow(BadRequestException);
    });

    it('rejeita padrão inválido (3 letras)', () => {
      expect(() => pipe.transform({ numeroIso: 'ABC12345670' })).toThrow(BadRequestException);
    });
  });
});
