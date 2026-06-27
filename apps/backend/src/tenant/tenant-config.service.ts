import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_TENANT_ID } from './tenant.constants';
import { DEFAULT_TENANT_PARAMETROS, mergeTenantParametros } from './tenant-config.types';

@Injectable()
export class TenantConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getParametros(tenantId: string = DEFAULT_TENANT_ID) {
    const row = await this.prisma.tenantConfig.findFirst({
      where: { OR: [{ tenantId }, { tenantKey: tenantId }] },
    });
    if (!row) {
      return { tenantId, nome: 'Default', parametros: DEFAULT_TENANT_PARAMETROS };
    }
    return {
      tenantId: row.tenantId,
      nome: row.nome,
      parametros: mergeTenantParametros(row.parametros),
    };
  }

  async updateParametros(tenantId: string, patch: Record<string, unknown>) {
    const current = await this.getParametros(tenantId);
    const merged = mergeTenantParametros({ ...current.parametros, ...patch });
    const row = await this.prisma.tenantConfig.update({
      where: { tenantId },
      data: { parametros: merged as object },
    });
    return { tenantId: row.tenantId, parametros: mergeTenantParametros(row.parametros) };
  }

  async getTurnosAgendamento(tenantId: string = DEFAULT_TENANT_ID) {
    const { parametros } = await this.getParametros(tenantId);
    return parametros.operacao?.turnos ?? DEFAULT_TENANT_PARAMETROS.operacao!.turnos!;
  }

  async assertTenantExists(tenantId: string) {
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!t) throw new NotFoundException('Tenant não encontrado');
    return t;
  }
}
