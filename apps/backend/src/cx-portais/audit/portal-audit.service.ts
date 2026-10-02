import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { sanitizePortalAuditPayload, summarizeAuditResult } from './portal-audit-sanitize';

export type PortalAuditInput = {
  clienteId?: string | null;
  usuarioPortalId?: string | null;
  acao: string;
  rota: string;
  metodoHttp: string;
  payloadEnviado?: unknown;
  resultado?: unknown;
  ip: string;
  userAgent: string;
};

@Injectable()
export class PortalAuditService {
  private readonly logger = new Logger(PortalAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registrar(input: PortalAuditInput): Promise<void> {
    try {
      await this.prisma.portalAuditoria.create({
        data: {
          clienteId: input.clienteId ?? undefined,
          usuarioPortalId: input.usuarioPortalId ?? undefined,
          acao: input.acao.slice(0, 120),
          rota: input.rota.slice(0, 512),
          metodoHttp: input.metodoHttp.slice(0, 16),
          payloadEnviado:
            input.payloadEnviado !== undefined
              ? (sanitizePortalAuditPayload(input.payloadEnviado) as object)
              : undefined,
          resultado:
            input.resultado !== undefined ? (summarizeAuditResult(input.resultado) as object) : undefined,
          ip: input.ip.slice(0, 64),
          userAgent: input.userAgent.slice(0, 512),
        },
      });
    } catch (e) {
      this.logger.warn(`portal_auditorias: falha ao registrar (${input.rota}): ${(e as Error).message}`);
    }
  }
}
