import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function mensagemCpfJaCadastrado(nome?: string | null): string {
  if (nome?.trim()) {
    return `CPF já cadastrado: ${nome.trim()}. Cada CPF pode ter apenas um cadastro.`;
  }
  return 'CPF já cadastrado. Cada CPF pode ter apenas um cadastro.';
}

export function mensagemCnpjJaCadastrado(nome?: string | null): string {
  if (nome?.trim()) {
    return `CNPJ já cadastrado: ${nome.trim()}. Cada CNPJ pode ter apenas um cadastro.`;
  }
  return 'CNPJ já cadastrado. Cada CNPJ pode ter apenas um cadastro.';
}

export function isPrismaUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export function throwDocumentoUnicoSeConflito(
  error: unknown,
  kind: 'CPF' | 'CNPJ',
  nome?: string | null,
): never {
  if (isPrismaUniqueViolation(error)) {
    throw new ConflictException(
      kind === 'CPF' ? mensagemCpfJaCadastrado(nome) : mensagemCnpjJaCadastrado(nome),
    );
  }
  throw error;
}
