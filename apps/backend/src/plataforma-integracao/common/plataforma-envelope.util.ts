import { NotFoundException } from '@nestjs/common';
import type { PlataformaApiClient } from '../plataforma.types';

export function envelopeOk<T>(
  data: T,
  meta: Partial<{ requestId: string; tenantId: string; apiVersion: string }>,
) {
  return {
    success: true as const,
    data,
    meta: {
      apiVersion: 'v1',
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

export function assertCliente(
  c: PlataformaApiClient | undefined,
): asserts c is PlataformaApiClient {
  if (!c) throw new NotFoundException('Contexto de cliente público ausente');
}
