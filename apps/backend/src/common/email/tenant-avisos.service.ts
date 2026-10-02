import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_TENANT_ID } from '../../tenant/tenant.constants';
import { TenantContextService } from '../../tenant/tenant-context.service';
import type { SmtpTenantSnapshot } from './resolve-smtp-config.util';

export type TenantAvisosConfig = {
  /** Remetente: Parâmetros → Operacional. */
  emailEnvio?: string;
  emailEnvioNome?: string;
  smtp: SmtpTenantSnapshot;
  /** Destinos e canais: Parâmetros → Notificações. */
  emailsAlerta: string[];
  webhookUrl?: string;
  webhookHabilitado: boolean;
  debounceAlertasMin?: number;
};

const VAZIO: TenantAvisosConfig = { smtp: {}, emailsAlerta: [], webhookHabilitado: false };

type ParametrosLidos = {
  operacional?: {
    emailEnvio?: string;
    emailEnvioNome?: string;
    emailSmtpHost?: string;
    emailSmtpPorta?: number;
    emailSmtpUsuario?: string;
  };
  notificacoes?: {
    emailsAlerta?: string[];
    webhookSlackUrl?: string;
    webhookSlackEnabled?: boolean;
    debounceAlertasMin?: number;
  };
  emailSmtp?: { senha?: string };
};

/** Parâmetros de envio e de aviso do terminal atual, em uma leitura só. */
@Injectable()
export class TenantAvisosService {
  private readonly logger = new Logger(TenantAvisosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  async carregar(): Promise<TenantAvisosConfig> {
    try {
      const tenantId = this.tenantCtx.getTenantId() || DEFAULT_TENANT_ID;
      const row = await this.prisma.tenantConfig.findFirst({
        where: { OR: [{ tenantId }, { tenantKey: tenantId }] },
        select: { parametros: true },
      });
      const parametros = row?.parametros as ParametrosLidos | null;
      return {
        emailEnvio: parametros?.operacional?.emailEnvio,
        emailEnvioNome: parametros?.operacional?.emailEnvioNome,
        smtp: {
          host: parametros?.operacional?.emailSmtpHost,
          porta: parametros?.operacional?.emailSmtpPorta,
          usuario: parametros?.operacional?.emailSmtpUsuario,
          senha: parametros?.emailSmtp?.senha,
        },
        emailsAlerta: parametros?.notificacoes?.emailsAlerta ?? [],
        webhookUrl: parametros?.notificacoes?.webhookSlackUrl,
        webhookHabilitado: parametros?.notificacoes?.webhookSlackEnabled === true,
        debounceAlertasMin: parametros?.notificacoes?.debounceAlertasMin,
      };
    } catch (e) {
      this.logger.warn(
        `Não foi possível ler parâmetros de aviso do tenant: ${e instanceof Error ? e.message : e}`,
      );
      return VAZIO;
    }
  }
}
