import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AcaoAuditoria, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CockpitTimelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private slaGateDef() {
    return Math.max(1, parseInt(this.config.get<string>('INTEGRACAO_SLA_HORAS_PADRAO') ?? '72', 10) || 72);
  }

  /** Ciclo portaria → gate → pátio → saída com SLA estimado (read-only). */
  async fluxo(limite = 80) {
    const sols = await this.prisma.solicitacao.findMany({
      where: { deletedAt: null },
      include: { portaria: true, gate: true, patio: true, saida: true, cliente: { select: { nome: true } } },
      orderBy: { updatedAt: 'desc' },
      take: limite,
    });
    const slaH = this.slaGateDef();
    return {
      geradoEm: new Date().toISOString(),
      slaReferenciaHoras: slaH,
      ciclos: sols.map((s) => {
        const etapas: Array<{ etapa: string; em: string | null; okSlaProxy: boolean | null }> = [
          {
            etapa: 'portaria',
            em: s.portaria?.createdAt?.toISOString() ?? null,
            okSlaProxy: null,
          },
          {
            etapa: 'gate_in',
            em: s.gate?.updatedAt?.toISOString() ?? null,
            okSlaProxy:
              s.portaria && s.gate
                ? horasEntre(s.portaria.createdAt, s.gate.updatedAt) <= slaH
                : null,
          },
          {
            etapa: 'patio',
            em: s.patio?.updatedAt?.toISOString() ?? null,
            okSlaProxy:
              s.gate && s.patio
                ? horasEntre(s.gate.updatedAt, s.patio.updatedAt) <= slaH * 2
                : null,
          },
          {
            etapa: 'gate_out',
            em: s.saida?.dataHoraSaida?.toISOString() ?? null,
            okSlaProxy:
              s.patio && s.saida
                ? horasEntre(s.patio.updatedAt, s.saida.dataHoraSaida) <= slaH
                : null,
          },
        ];
        return {
          protocolo: s.protocolo,
          clienteNome: s.cliente.nome,
          status: s.status,
          atualizadoEm: s.updatedAt.toISOString(),
          etapas,
          cicloCompleto: !!(s.portaria && s.gate && s.patio && s.saida),
        };
      }),
    };
  }

  /** Eventos críticos ordenados: auditoria + proxies operacionais. */
  async eventos(limite = 120) {
    const [aud, pendNfe, gateSemPortaria] = await Promise.all([
      this.prisma.auditoria.findMany({
        where: { acao: { in: [AcaoAuditoria.SEGURANCA, AcaoAuditoria.DELETE] } },
        orderBy: { createdAt: 'desc' },
        take: limite,
      }),
      this.prisma.faturamento.count({ where: { statusNfe: { contains: 'pend', mode: 'insensitive' } } }).catch(() => 0),
      this.detectarGateSemPortaria(),
    ]);

    const criticos = gateSemPortaria.map((g) => ({
      tipo: 'OPS_GATE_SEM_PORTARIA',
      severidade: 'alta' as const,
      em: new Date().toISOString(),
      detalhe: g,
    }));

    return {
      geradoEm: new Date().toISOString(),
      resumoProxies: {
        notasPendentesProxy: pendNfe,
        alertasGrcStyle: parseInt(this.config.get<string>('GRC_INCIDENTES_SEGURANCA_PROXY') ?? '0', 10) || null,
      },
      auditoriaCritica: aud.map((a) => ({
        id: a.id,
        tabela: a.tabela,
        acao: a.acao,
        usuario: a.usuario,
        em: a.createdAt.toISOString(),
      })),
      criticosOperacionais: criticos.slice(0, 40),
    };
  }

  private async detectarGateSemPortaria(): Promise<string[]> {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ protocolo: string }>>(
        Prisma.sql`
          SELECT s.protocolo
          FROM gates g
          INNER JOIN solicitacoes s ON s.id = g."solicitacaoId"
          LEFT JOIN portarias p ON p."solicitacaoId" = s.id
          WHERE s."deletedAt" IS NULL AND p.id IS NULL
          LIMIT 20
        `,
      );
      return rows.map((r) => r.protocolo);
    } catch {
      return [];
    }
  }
}

function horasEntre(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / (3600 * 1000);
}
