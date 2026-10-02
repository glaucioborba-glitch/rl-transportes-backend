import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  isPrismaUniqueViolation,
  mensagemCnpjJaCadastrado,
  mensagemCpfJaCadastrado,
  throwDocumentoUnicoSeConflito,
} from './documento-unico.util';

describe('documento-unico.util', () => {
  it('mensagem de CPF inclui o nome quando houver', () => {
    expect(mensagemCpfJaCadastrado('João')).toContain('João');
    expect(mensagemCpfJaCadastrado()).toBe(
      'CPF já cadastrado. Cada CPF pode ter apenas um cadastro.',
    );
  });

  it('mensagem de CNPJ inclui a razão social quando houver', () => {
    expect(mensagemCnpjJaCadastrado('RL Log')).toContain('RL Log');
  });

  it('reconhece P2002 do Prisma', () => {
    const err = new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002',
      clientVersion: 'test',
    });
    expect(isPrismaUniqueViolation(err)).toBe(true);
    expect(isPrismaUniqueViolation(new Error('x'))).toBe(false);
  });

  it('converte P2002 em ConflictException de documento', () => {
    const err = new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002',
      clientVersion: 'test',
    });
    expect(() => throwDocumentoUnicoSeConflito(err, 'CPF', 'Ana')).toThrow(ConflictException);
  });
});
