import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { CxPortalRequestUser } from './types/cx-portal.types';

type ClienteTenantLookup = {
  cliente: {
    findFirst: (args: {
      where: { id: string; tenantId: string; deletedAt: null };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
};

type SolicitacaoTenantLookup = {
  solicitacao: {
    findFirst: (args: {
      where: { id: string; deletedAt: null };
      select: { id: true; clienteId: true; tenantId: true };
    }) => Promise<{ id: string; clienteId: string; tenantId: string } | null>;
  };
};

/** Impede STAFF de um tenant consultar/faturar cliente de outro tenant via query string. */
export async function assertClienteDoTenant(
  prisma: ClienteTenantLookup,
  tenantId: string,
  clienteId: string,
): Promise<string> {
  const row = await prisma.cliente.findFirst({
    where: { id: clienteId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!row) throw new NotFoundException('Cliente não encontrado');
  return row.id;
}

/**
 * STAFF: cliente precisa ser do tenant do JWT.
 * CLIENTE: só o próprio clienteId.
 */
export async function assertClienteAccessPortal(
  prisma: ClienteTenantLookup,
  cx: CxPortalRequestUser,
  clienteId: string,
): Promise<string> {
  if (cx.portalPapel === 'STAFF') {
    return assertClienteDoTenant(prisma, cx.tenantId, clienteId);
  }
  if (cx.portalPapel !== 'CLIENTE' || cx.clienteId !== clienteId) {
    throw new NotFoundException('Cliente não encontrado');
  }
  return clienteId;
}

/** Staff e portal só leem OS do próprio tenant. */
export async function assertSolicitacaoDoTenant(
  prisma: SolicitacaoTenantLookup,
  solicitacaoId: string,
  tenantId: string,
  clienteId?: string | null,
): Promise<{ id: string; clienteId: string; tenantId: string }> {
  const sol = await prisma.solicitacao.findFirst({
    where: { id: solicitacaoId, deletedAt: null },
    select: { id: true, clienteId: true, tenantId: true },
  });
  if (!sol || sol.tenantId !== tenantId) {
    throw new NotFoundException('Solicitação não encontrada');
  }
  if (clienteId && sol.clienteId !== clienteId) {
    throw new NotFoundException('Solicitação não encontrada');
  }
  return sol;
}

/** STAFF não pode trocar de tenant via query string. */
export function assertTenantDaSessao(cx: CxPortalRequestUser, tenantIdParam?: string): string {
  const requested = tenantIdParam?.trim();
  if (requested && requested !== cx.tenantId) {
    throw new BadRequestException('Tenant da consulta não confere com a sessão.');
  }
  return cx.tenantId;
}
