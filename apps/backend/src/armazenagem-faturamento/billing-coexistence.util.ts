import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { normalizeContainerIso } from '../common/utils/data-sanitize';

/** Evita double-charge no mesmo ISO enquanto há pré-fatura ABERTA. Histórico CONSOLIDADA não bloqueia novo ID. */
export async function assertNoConflictingBilling(
  db: Prisma.TransactionClient | { preFatura: Prisma.PreFaturaDelegate; fatura: Prisma.FaturaDelegate },
  input: { containerIso: string; clienteId: string; gateInId?: string | null; unidadeProcessoId?: string | null },
): Promise<void> {
  const iso = normalizeContainerIso(input.containerIso).replace(/\s/g, '').toUpperCase();
  const open = await db.preFatura.findFirst({
    where: {
      containerIso: iso,
      clienteId: input.clienteId,
      status: 'ABERTA',
      ...(input.unidadeProcessoId ? { NOT: { unidadeProcessoId: input.unidadeProcessoId } } : {}),
      ...(input.gateInId ? { NOT: { gateInId: input.gateInId } } : {}),
    },
    select: { id: true, unidadeProcessoId: true },
  });
  if (open) {
    throw new ConflictException(
      `Já existe pré-fatura aberta para ISO ${iso} (${open.id}). Encerre o ID atual antes de nova cobrança.`,
    );
  }
}

export async function hasConsolidatedPreFaturaForIso(
  db: { preFatura: Prisma.PreFaturaDelegate },
  containerIso: string,
  clienteId: string,
): Promise<boolean> {
  const iso = normalizeContainerIso(containerIso).replace(/\s/g, '').toUpperCase();
  const hit = await db.preFatura.findFirst({
    where: { containerIso: iso, clienteId, status: { in: ['ABERTA', 'CONSOLIDADA'] } },
    select: { id: true, status: true, unidadeProcessoId: true },
  });
  return Boolean(hit?.status === 'ABERTA' || hit?.unidadeProcessoId);
}
