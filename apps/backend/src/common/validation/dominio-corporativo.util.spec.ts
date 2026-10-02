import { ValidacaoDominio } from '@prisma/client';
import { compareDominioCorporativo, extractEmailDomain } from './dominio-corporativo.util';

describe('dominio-corporativo.util', () => {
  it('extractEmailDomain', () => {
    expect(extractEmailDomain('Contato@Empresa.COM.BR')).toBe('empresa.com.br');
    expect(extractEmailDomain('invalid')).toBeNull();
  });

  it('compareDominioCorporativo', () => {
    expect(compareDominioCorporativo('a@empresa.com', 'b@empresa.com')).toBe(
      ValidacaoDominio.APROVADO,
    );
    expect(compareDominioCorporativo('a@gmail.com', 'b@empresa.com')).toBe(
      ValidacaoDominio.DIVERGENTE,
    );
    expect(compareDominioCorporativo('a@gmail.com', '')).toBe(ValidacaoDominio.INDISPONIVEL);
  });
});
