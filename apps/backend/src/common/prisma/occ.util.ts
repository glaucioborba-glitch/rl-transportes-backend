import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const OCC_CONFLICT_MESSAGE =
  'Este registro foi modificado por outro operador. Atualize a tela e tente novamente.';

export function isPrismaRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

export function rethrowOccConflict(error: unknown): never {
  if (isPrismaRecordNotFound(error)) {
    throw new ConflictException(OCC_CONFLICT_MESSAGE);
  }
  throw error;
}

export async function withOcc<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    rethrowOccConflict(error);
  }
}
