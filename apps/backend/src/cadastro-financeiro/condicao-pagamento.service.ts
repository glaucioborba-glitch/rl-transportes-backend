import { Injectable, NotFoundException } from '@nestjs/common';
import { resolveStoreTenantId } from '../common/stores/store-tenant.util';
import { DEFAULT_TENANT_ID } from '../tenant/tenant.constants';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

export type CondicaoPagamentoOption = { label: string; value: string };

const FALLBACK: CondicaoPagamentoOption[] = [
  { label: 'Faturamento', value: 'FATURAMENTO' },
  { label: 'À Vista PIX', value: 'AVISTA_PIX' },
];

@Injectable()
export class CondicaoPagamentoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  async listarAtivas(): Promise<CondicaoPagamentoOption[]> {
    const tenantKey = resolveStoreTenantId(this.tenantCtx);
    const config = await this.prisma.tenantConfig.findFirst({
      where: { OR: [{ tenantId: tenantKey }, { tenantKey: tenantKey === DEFAULT_TENANT_ID ? 'default' : tenantKey }] },
      include: {
        condicoesPagamentoPersonalizadas: { where: { ativo: true }, orderBy: { label: 'asc' } },
      },
    });
    if (!config?.condicoesPagamentoPersonalizadas.length) {
      return FALLBACK;
    }
    return config.condicoesPagamentoPersonalizadas.map((c) => ({
      label: c.label,
      value: c.value,
    }));
  }

  async assertValorPermitido(value: string): Promise<void> {
    const opcoes = await this.listarAtivas();
    if (!opcoes.some((o) => o.value === value)) {
      throw new NotFoundException(`Condição de pagamento "${value}" não configurada para o tenant`);
    }
  }
}
