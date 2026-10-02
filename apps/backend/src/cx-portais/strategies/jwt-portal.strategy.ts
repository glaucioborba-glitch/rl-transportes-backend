import { UnauthorizedException } from '@nestjs/common';
import type { PortalAccessTokenPayload } from '../types/cx-portal.types';

/**
 * Valida claims mínimas do access token portal (CLIENTE).
 * Usado pelo `CxPortalAuthGuard` após `verifyAccess`.
 */
export function assertPortalClienteTokenPayload(pl: PortalAccessTokenPayload): void {
  if (pl.portalPapel !== 'CLIENTE') return;
  if (!pl.cpfCnpj?.replace(/\D/g, '').length) {
    throw new UnauthorizedException('Token portal inválido: cpfCnpj ausente.');
  }
  if (pl.clienteId == null || String(pl.clienteId).trim() === '') {
    throw new UnauthorizedException('Token portal inválido: clienteId ausente.');
  }
}
