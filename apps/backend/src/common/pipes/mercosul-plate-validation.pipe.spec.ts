import { BadRequestException } from '@nestjs/common';
import { MercosulPlateValidationPipe } from './mercosul-plate-validation.pipe';

describe('MercosulPlateValidationPipe', () => {
  const pipe = new MercosulPlateValidationPipe();

  describe('Placa Mercosul válida', () => {
    it('aceita padrão com hífen (ABCD-1D34)', () => {
      const b = { placa: 'ABCD-1D34' };
      pipe.transform(b);
      expect(b.placa).toBe('ABCD1D34');
    });

    it('aceita padrão sem hífen (ABCD1D34)', () => {
      const b = { placa: 'ABCD1D34' };
      pipe.transform(b);
      expect(b.placa).toBe('ABCD1D34');
    });

    it('converte para UPPERCASE', () => {
      const b = { placa: 'abcd-1d34' };
      pipe.transform(b);
      expect(b.placa).toBe('ABCD1D34');
    });

    it('remove hífen e normaliza', () => {
      const b = { placa: ' X Y Z W - 9 A 1 2 ' };
      pipe.transform(b);
      expect(b.placa).toBe('XYZW9A12');
    });
  });

  describe('Validações', () => {
    it('rejeita padrão inválido (< 4 letras iniciais efetivas)', () => {
      expect(() => pipe.transform({ placa: 'ABC-1D34' })).toThrow(BadRequestException);
    });

    it('rejeita padrão inválido (letra na 2ª posição da parte numérica)', () => {
      expect(() => pipe.transform({ placa: 'ABCD-D134' })).toThrow(BadRequestException);
    });
  });
});
