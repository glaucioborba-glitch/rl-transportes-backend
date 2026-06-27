import { BadRequestException } from '@nestjs/common';
import { normalizeLoginDocumento, sanitizeDocumentoInput } from './login-documento.util';

describe('login-documento.util', () => {
  it('normaliza CPF com 11 dígitos', () => {
    expect(normalizeLoginDocumento('03650163900')).toBe('00003650163900');
  });

  it('recupera CPF após coerção numérica (10 dígitos)', () => {
    expect(normalizeLoginDocumento('3650163900')).toBe('00003650163900');
  });

  it('sanitizeDocumentoInput preserva string com zero à esquerda', () => {
    expect(sanitizeDocumentoInput('03650163900')).toBe('03650163900');
  });

  it('sanitizeDocumentoInput converte número coercido', () => {
    expect(sanitizeDocumentoInput(3650163900)).toBe('3650163900');
  });

  it('rejeita documento inválido', () => {
    expect(() => normalizeLoginDocumento('123')).toThrow(BadRequestException);
  });
});
