import { BadRequestException } from '@nestjs/common';
import { StaffLoginCpfPipe } from './staff-login-cpf.pipe';

describe('StaffLoginCpfPipe', () => {
  const pipe = new StaffLoginCpfPipe();

  it('CPF válido (11 dígitos) → sanitizado', () => {
    const body = { documento: '52998224725', password: 'x' };
    pipe.transform(body);
    expect(body.documento).toBe('52998224725');
  });

  it('CPF com máscara → OK', () => {
    const body = { documento: '529.982.247-25', password: 'x' };
    pipe.transform(body);
    expect(body.documento).toBe('52998224725');
  });

  it('CNPJ (14 dígitos) → bloqueado', () => {
    expect(() => pipe.transform({ documento: '11000000000108', password: 'x' })).toThrow(
      BadRequestException,
    );
    try {
      pipe.transform({ documento: '11000000000108', password: 'x' });
    } catch (e) {
      expect((e as BadRequestException).message).toBe(
        'Login de funcionários aceita apenas CPF (11 dígitos)',
      );
    }
  });

  it('CPF com dígitos verificadores inválidos → 400', () => {
    expect(() => pipe.transform({ documento: '11111111111', password: 'x' })).toThrow(
      BadRequestException,
    );
    try {
      pipe.transform({ documento: '11111111111', password: 'x' });
    } catch (e) {
      expect((e as BadRequestException).message).toBe(
        'CPF inválido — dígitos verificadores não conferem',
      );
    }
  });

  it('documento com tamanho inválido → 400', () => {
    expect(() => pipe.transform({ documento: '123', password: 'x' })).toThrow(BadRequestException);
    try {
      pipe.transform({ documento: '123', password: 'x' });
    } catch (e) {
      expect((e as BadRequestException).message).toBe('CPF deve conter exatamente 11 dígitos');
    }
  });

  it('e-mail → bloqueado', () => {
    expect(() =>
      pipe.transform({ documento: 'funcionario@rl.com', password: 'x' }),
    ).toThrow(BadRequestException);
    try {
      pipe.transform({ documento: 'funcionario@rl.com', password: 'x' });
    } catch (e) {
      expect((e as BadRequestException).message).toBe(
        'Login da intranet aceita apenas CPF, não e-mail',
      );
    }
  });

  it('campo cpf alias → OK', () => {
    const body = { cpf: '529.982.247-25', password: 'x' };
    pipe.transform(body);
    expect(body).toEqual({ cpf: '529.982.247-25', password: 'x', documento: '52998224725' });
  });
});
