import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PlataformaMarketplaceService } from '../../plataforma-integracao/services/plataforma-marketplace.service';
import type { MobileRequestUser } from '../types/mobile-hub.types';

@Injectable()
export class MobileHubClienteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketplace: PlataformaMarketplaceService,
  ) {}

  private clienteId(cx: MobileRequestUser) {
    if (!cx.clienteId) throw new BadRequestException('Usuário sem vínculo de cliente');
    return cx.clienteId;
  }

  async tracking(cx: MobileRequestUser) {
    const cid = this.clienteId(cx);
    const [sols, kpis] = await Promise.all([
      this.prisma.solicitacao.findMany({
        where: { clienteId: cid, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        select: {
          id: true,
          protocolo: true,
          status: true,
          updatedAt: true,
        },
      }),
      this.prisma.solicitacao.count({
        where: { clienteId: cid, deletedAt: null, status: 'CONCLUIDO' },
      }),
    ]);
    const servicos = this.marketplace.listarServicos();
    return {
      linhaDoTempo: sols.map((s) => ({
        p: s.protocolo,
        st: s.status,
        u: s.updatedAt.toISOString(),
        
      })),
      kpiConcluidas: kpis,
      marketplaceProxy: { success: true, totalServicos: servicos.length },
      biSimplificadoProxy: { ocupacaoPct: null, cicloMedioH: null },
    };
  }
}
