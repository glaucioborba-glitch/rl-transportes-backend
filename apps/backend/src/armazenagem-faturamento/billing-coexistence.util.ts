import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { normalizeContainerIso } from '../common/utils/data-sanitize';

/** Evita double-charge Gate-v2 (PreFatura) vs TOS (BILLING_TRIGGERED) no mesmo ISO/período. */
export async function assertNoConflictingBilling(
  db: Prisma.TransactionClient | { preFatura: Prisma.PreFaturaDelegate; fatura: Prisma.FaturaDelegate },
  input: { containerIso: string; clienteId: string; gateInId?: string },
): Promise<void> {
  const iso = normalizeContainerIso(input.containerIso).replace(/\s/g, '').toUpperCase();
  const open = await db.preFatura.findFirst({
    where: {
      containerIso: iso,
      clienteId: input.clienteId,
      status: 'CONSOLIDADA',
      ...(input.gateInId ? { NOT: { gateInId: input.gateInId } } : {}),
    },
    include: { fatura: true },
  });
  if (open?.fatura) {
    throw new ConflictException(
      `Cobrança já consolidada para ISO ${iso} (fatura ${open.fatura.id}). Abortando duplicata.`,
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
    where: { containerIso: iso, clienteId, status: 'CONSOLIDADA' },
    select: { id: true },
  });
  return Boolean(hit);
}
