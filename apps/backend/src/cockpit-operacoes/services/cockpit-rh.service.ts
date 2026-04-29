import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CockpitRHService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async turno() {
    const hoje = new Date().toISOString().slice(0, 10);
    const [operadores, gerentes] = await Promise.all([
      this.prisma.user.count({
        where: {
          role: { in: [Role.OPERADOR_PORTARIA, Role.OPERADOR_GATE, Role.OPERADOR_PATIO] },
        },
      }),
      this.prisma.user.count({ where: { role: Role.GERENTE } }),
    ]);
    const ausenciasProxy = parseInt(this.config.get<string>('GRC_RH_AUSENCIAS_PROXY') ?? '0', 10);
    const presencaEstimadaPct =
      operadores > 0 && ausenciasProxy >= 0
        ? Math.max(0, Math.min(100, Math.round(((operadores - ausenciasProxy) / operadores) * 100)))
        : null;

    return {
      geradoEm: new Date().toISOString(),
      dataReferencia: hoje,
      headcountOperadores: operadores,
      headcountGerentes: gerentes,
      presencaPorTurnoProxyPct: presencaEstimadaPct,
      ausenciasProxy,
      observacao:
        'Presença é proxy (Fase 22 read-only); integrar folha/ponto sem migration nas próximas fases.',
    };
  }

  async eficiencia() {
    const prodIaProxy = parseFloat(this.config.get<string>('COCKPIT_RH_PROD_IA_PROXY') ?? '0.82');
    const gargaloProxy = this.config.get<string>('COCKPIT_RH_GARGALO_PROXY') ?? null;
    const t = await this.turno();
    return {
      geradoEm: new Date().toISOString(),
      turno: t,
      produtividadePrevistaIaProxy: prodIaProxy > 0 ? prodIaProxy : null,
      gargalosMaoDeObraProxy: gargaloProxy ? [gargaloProxy] : [],
    };
  }
}
