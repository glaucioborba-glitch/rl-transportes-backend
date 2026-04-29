import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PlataformaTenantStore } from '../../plataforma-integracao/stores/plataforma-tenant.store';
import type { PlataformaTenant } from '../../plataforma-integracao/plataforma.types';
import { CockpitIndicadoresService } from './cockpit-indicadores.service';
import { CockpitAlertasService } from './cockpit-alertas.service';
import { CockpitMapService } from './cockpit-map.service';

@Injectable()
export class CockpitTenantService {
  constructor(
    private readonly tenants: PlataformaTenantStore,
    private readonly prisma: PrismaService,
    private readonly indicadores: CockpitIndicadoresService,
    private readonly alertas: CockpitAlertasService,
    private readonly mapa: CockpitMapService,
  ) {}

  listar() {
    const ts = this.tenants.listar();
    return {
      geradoEm: new Date().toISOString(),
      terminais: ts.map((t: PlataformaTenant) => ({
        id: t.id,
        nome: t.nome,
        clienteIds: t.clienteIds,
        horarioFuncionamento: t.config.horarioFuncionamento,
      })),
    };
  }

  async dashboard(tenantId: string) {
    const t = this.tenants.obter(tenantId);
    if (!t) throw new NotFoundException('Terminal não encontrado');
    const filtroCliente =
      t.clienteIds?.length > 0 ? { clienteId: { in: t.clienteIds } } : undefined;
    const patioWhere =
      (t.clienteIds?.length ?? 0) > 0
        ? { solicitacao: { clienteId: { in: t.clienteIds }, deletedAt: null } }
        : {};
    const [solicitacoes, patioAgg] = await Promise.all([
      this.prisma.solicitacao.count({
        where: { deletedAt: null, ...(filtroCliente ?? {}) },
      }),
      this.prisma.patio.count({ where: patioWhere }),
    ]);
    const [ind, al, patioMap] = await Promise.all([
      this.indicadores.resumo(),
      this.alertas.todos(),
      this.mapa.patio(),
    ]);
    return {
      geradoEm: new Date().toISOString(),
      tenant: { id: t.id, nome: t.nome, config: t.config },
      eventosUnificadosProxy: {
        solicitacoes,
        patioPosicoesTenant: patioAgg,
        alertasTotal: al.total,
      },
      mapaPatioGlobalNota:
        'Mapa completo abaixo; filtro fino por tenant usa clienteIds quando configurado.',
      mapaPatio: patioMap,
      indicadoresGlobaisProxy: ind,
      alertasRecentes: al.itens.slice(0, 25),
    };
  }
}
