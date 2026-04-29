import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MobilePushStore } from '../../mobile-hub/stores/mobile-push.store';
import { AutomacaoExecucaoStore } from '../../automacao-processos/stores/automacao-execucao.store';
import type { AutomacaoExecucaoLog } from '../../automacao-processos/stores/automacao-execucao.store';
import { MobileTelemetryStore } from '../../mobile-hub/stores/mobile-telemetry.store';
import type { MobileTelemetryBatch } from '../../mobile-hub/stores/mobile-telemetry.store';

export type CockpitSeveridade = 'critica' | 'alta' | 'media' | 'baixa';

export interface CockpitAlertItem {
  id: string;
  fonte: string;
  severidade: CockpitSeveridade;
  titulo: string;
  detalhe: string;
  em: string;
  meta?: Record<string, unknown>;
}

@Injectable()
export class CockpitAlertasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly push: MobilePushStore,
    private readonly execAutomacao: AutomacaoExecucaoStore,
    private readonly tel: MobileTelemetryStore,
  ) {}

  async todos() {
    const partes = await Promise.all([
      this.alertasIaStyle(),
      this.alertasFiscalFinanceiro(),
      this.alertasAutomacao(),
      this.alertasMobile(),
      this.alertasGrcProxy(),
    ]);
    const itens = partes.flat().sort((a, b) => ordSev(a.severidade) - ordSev(b.severidade));
    return { geradoEm: new Date().toISOString(), total: itens.length, itens };
  }

  async criticos() {
    const { itens, ...rest } = await this.todos();
    const c = itens.filter((x) => x.severidade === 'critica' || x.severidade === 'alta');
    return { ...rest, total: c.length, itens: c };
  }

  private async alertasIaStyle(): Promise<CockpitAlertItem[]> {
    const out: CockpitAlertItem[] = [];
    try {
      const rows = await this.prisma.$queryRaw<Array<{ iso: string; c: bigint }>>(
        Prisma.sql`
          SELECT u."numeroIso" AS iso, COUNT(*)::bigint AS c
          FROM unidades_solicitacao u
          INNER JOIN solicitacoes s ON s.id = u."solicitacaoId"
          WHERE s."deletedAt" IS NULL
          GROUP BY u."numeroIso"
          HAVING COUNT(*) > 1
          LIMIT 15
        `,
      );
      for (const r of rows) {
        out.push({
          id: `ia-iso-${r.iso}`,
          fonte: 'ia_preditiva',
          severidade: 'alta',
          titulo: 'Anomalia: ISO duplicado',
          detalhe: `ISO ${r.iso} em ${Number(r.c)} solicitações.`,
          em: new Date().toISOString(),
          meta: { iso: r.iso },
        });
      }
    } catch {
      /* read-only agregação */
    }
    const z = parseFloat(this.config.get<string>('IA_PRED_ANOM_Z') ?? '2.5');
    if (z > 4) {
      out.push({
        id: 'ia-config-z',
        fonte: 'ia_preditiva',
        severidade: 'media',
        titulo: 'Limite de anomalia elevado (proxy config)',
        detalhe: `IA_PRED_ANOM_Z=${z}`,
        em: new Date().toISOString(),
      });
    }
    return out;
  }

  private async alertasFiscalFinanceiro(): Promise<CockpitAlertItem[]> {
    try {
      const out: CockpitAlertItem[] = [];
      const [pendNfe, boletoAtraso, fatZip] = await Promise.all([
        this.prisma.faturamento.count({ where: { statusNfe: { contains: 'pend', mode: 'insensitive' } } }),
        this.prisma.boleto.count({
          where: {
            statusPagamento: { contains: 'pend', mode: 'insensitive' },
            dataVencimento: { lt: new Date() },
          },
        }),
        this.detectarFaturamentoZip(),
      ]);

      if (pendNfe > 0) {
        out.push({
          id: 'fiscal-nfe-pend',
          fonte: 'fiscal',
          severidade: pendNfe > 10 ? 'alta' : 'media',
          titulo: 'Notas fiscais pendentes',
          detalhe: `${pendNfe} faturamento(s) com NF pendente (proxy).`,
          em: new Date().toISOString(),
          meta: { count: pendNfe },
        });
      }
      if (boletoAtraso > 0) {
        out.push({
          id: 'fin-boleto-atraso',
          fonte: 'financeiro',
          severidade: boletoAtraso > 5 ? 'alta' : 'media',
          titulo: 'Boletos vencidos não quitados',
          detalhe: `${boletoAtraso} boleto(s) em atraso.`,
          em: new Date().toISOString(),
        });
      }
      out.push(...fatZip);
      return out;
    } catch {
      return [];
    }
  }

  private async detectarFaturamentoZip(): Promise<CockpitAlertItem[]> {
    /* proxy leve: diferença cabeça vs soma itens (amostra) */
    try {
      const fat = await this.prisma.faturamento.findMany({
        take: 30,
        include: { itens: true },
        orderBy: { updatedAt: 'desc' },
      });
      const out: CockpitAlertItem[] = [];
      for (const f of fat) {
        const sum = f.itens.reduce((a: number, i: { valor: unknown }) => a + Number(i.valor), 0);
        const head = Number(f.valorTotal);
        if (Math.abs(sum - head) > 0.02) {
          out.push({
            id: `fiscal-dif-${f.id}`,
            fonte: 'fiscal',
            severidade: 'media',
            titulo: 'Possível divergência faturamento × itens',
            detalhe: `Faturamento ${f.periodo} cliente ${f.clienteId.slice(0, 8)}…`,
            em: f.updatedAt.toISOString(),
          });
        }
      }
      return out;
    } catch {
      return [];
    }
  }

  private alertasAutomacao(): CockpitAlertItem[] {
    const erros = this.execAutomacao.comErroUltimas24h();
    return erros.slice(0, 40).map((e: AutomacaoExecucaoLog) => ({
      id: `auto-${e.id}`,
      fonte: 'automacao',
      severidade: 'alta' as CockpitSeveridade,
      titulo: 'Falha em execução de automação',
      detalhe: e.detalhe ?? e.evento ?? e.tipo ?? 'erro',
      em: e.criadoEm,
      meta: { ok: e.ok, tipo: e.tipo },
    }));
  }

  private alertasMobile(): CockpitAlertItem[] {
    const jobs = this.push.listarUltimos(40);
    const out: CockpitAlertItem[] = [];
    for (const j of jobs) {
      if (j.tipo === 'os_critica' || j.tipo === 'alerta_risco_grc') {
        out.push({
          id: `mob-${j.id}`,
          fonte: 'mobile_hub',
          severidade: j.tipo === 'alerta_risco_grc' ? 'critica' : 'alta',
          titulo: j.titulo,
          detalhe: j.corpo,
          em: j.criadoEm,
          meta: j.meta,
        });
      }
    }
    const tel = this.tel.ultimosJanela(80).filter((b: MobileTelemetryBatch) => b.errosRecorrentes?.length);
    for (const b of tel.slice(0, 15)) {
      out.push({
        id: `mob-tel-${b.id}`,
        fonte: 'mobile_telemetria',
        severidade: 'media',
        titulo: 'Erros recorrentes no app',
        detalhe: (b.errosRecorrentes ?? []).join('; ').slice(0, 200),
        em: b.recebidoEm,
      });
    }
    return out;
  }

  private alertasGrcProxy(): CockpitAlertItem[] {
    const thr = parseInt(this.config.get<string>('GRC_OCR_BACKLOG_THRESHOLD') ?? '50', 10) || 50;
    const backlog = parseInt(this.config.get<string>('GRC_OCR_BACKLOG_PROXY') ?? '0', 10);
    if (!Number.isFinite(backlog) || backlog <= 0) return [];
    const sev: CockpitSeveridade = backlog > thr ? 'alta' : 'media';
    return [
      {
        id: 'grc-ocr-backlog',
        fonte: 'grc_compliance',
        severidade: sev,
        titulo: 'Backlog OCR portaria (proxy GRC)',
        detalhe: `${backlog} itens vs limiar ${thr}`,
        em: new Date().toISOString(),
      },
    ];
  }
}

function ordSev(s: CockpitSeveridade): number {
  const o: Record<CockpitSeveridade, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };
  return o[s];
}
