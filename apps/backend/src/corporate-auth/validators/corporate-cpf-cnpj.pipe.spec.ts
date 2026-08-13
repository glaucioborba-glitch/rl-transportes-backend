import { BadRequestException } from '@nestjs/common';
import { CorporateCpfCnpjPipe } from './corporate-cpf-cnpj.pipe';

describe('CorporateCpfCnpjPipe', () => {
  const pipe = new CorporateCpfCnpjPipe();

  it('CPF sem máscara (11 dígitos) → sanitizado', () => {
    const body = { documento: '52998224725', password: 'x' };
    pipe.transform(body);
    expect(body.documento).toBe('52998224725');
  });

  it('CPF com máscara → OK', () => {
    const body = { documento: '529.982.247-25', password: 'x' };
    pipe.transform(body);
    expect(body.documento).toBe('52998224725');
  });

  it('CNPJ limpo (14 dígitos) → OK', () => {
    const body = { documento: '11000000000108', password: 'x' };
    pipe.transform(body);
    expect(body.documento).toBe('11000000000108');
  });

  it('CNPJ com máscara → OK', () => {
    const body = { documento: '11.000.000/0001-08', password: 'x' };
    pipe.transform(body);
    expect(body.documento).toBe('11000000000108');
  });

  it('cpfCnpj alias no body → normaliza para documento', () => {
    const body: Record<string, unknown> = { cpfCnpj: '11.000.000/0001-08', password: 'x' };
    pipe.transform(body);
    expect(body.documento).toBe('11000000000108');
  });

  it('documento inválido → 400 com mensagem clara', () => {
    expect(() => pipe.transform({ documento: '123', password: 'x' })).toThrow(
      BadRequestException,
    );
    try {
      pipe.transform({ documento: '123', password: 'x' });
    } catch (e) {
      expect((e as BadRequestException).message).toContain('11 (CPF) ou 14 (CNPJ)');
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

  it('CNPJ com dígitos verificadores inválidos → 400', () => {
    expect(() => pipe.transform({ documento: '00000000000000', password: 'x' })).toThrow(
      BadRequestException,
    );
  });
});
