import { Injectable, Logger } from '@nestjs/common';
import { AcaoAuditoria, ModalidadeTransporte, Prisma, StatusPreFatura, TipoOperacaoAgendamento } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { isBillingEligibleIntent } from '../billing-engine/billing-eligible-intents.util';
import { calculateReeferSurcharge, DEFAULT_TARIFA_ENERGIA_REEFER_DIA } from '../billing-engine/billing-rule-engine.util';
import { normalizeContainerIso } from '../common/utils/data-sanitize';
import { PrismaService } from '../prisma/prisma.service';
import { hasConsolidatedPreFaturaForIso } from '../armazenagem-faturamento/billing-coexistence.util';
import type { ContainerDispatchedPayload } from '../tos/container-lifecycle.service';

const TARIFA_ESTADIA_DIA = 85;
const TARIFA_LAVAGEM = 120;
const TARIFA_REEFER_ENERGIA_DIA = 45;
const TARIFA_FRETE_DEFAULT = 450;

@Injectable()
export class BillingOutboxProcessor {
  private readonly logger = new Logger(BillingOutboxProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Idempotente por outboxId — reprocessamento não duplica itens. */
  async processBillingTriggered(outboxId: string, raw: unknown): Promise<void> {
    const rawPayload = raw as ContainerDispatchedPayload & {
      gateInAt?: string | Date;
      gateOutAt?: string | Date;
    };
    const payload: ContainerDispatchedPayload = {
      ...rawPayload,
      gateInAt: new Date(rawPayload.gateInAt ?? 0),
      gateOutAt: new Date(rawPayload.gateOutAt ?? 0),
    };
    if (!payload?.containerId || !payload?.clienteId) {
      throw new Error('Payload BILLING_TRIGGERED inválido');
    }

    if (payload.solicitacaoId) {
      const sol = await this.prisma.solicitacao.findUnique({
        where: { id: payload.solicitacaoId },
        select: { tipoOperacao: true },
      });
      if (sol?.tipoOperacao && !isBillingEligibleIntent(sol.tipoOperacao)) {
        this.logger.log(
          `Outbox ${outboxId}: intent ${sol.tipoOperacao} não elegível para billing — skip`,
        );
        return;
      }

      const existingPreFatura = await this.prisma.preFatura.findFirst({
        where: {
          status: { in: [StatusPreFatura.ABERTA, StatusPreFatura.CONSOLIDADA] },
          gateIn: { solicitacaoId: payload.solicitacaoId },
        },
        select: { id: true, status: true },
      });
      if (existingPreFatura) {
        this.logger.log(
          `Pre-fatura ${existingPreFatura.id} já existe para solicitação ${payload.solicitacaoId} — skip (ALREADY_BILLED)`,
        );
        return;
      }
    }

    const numeroIso = normalizeContainerIso(payload.numero);
    if (await hasConsolidatedPreFaturaForIso(this.prisma, numeroIso, payload.clienteId)) {
      this.logger.log(
        `Outbox ${outboxId}: ISO ${numeroIso} já faturado via Gate-v2 — TOS billing ignorado (anti double-charge)`,
      );
      return;
    }

    const dup = await this.prisma.auditoria.findFirst({
      where: {
        tabela: 'faturamentos',
        usuario: 'system:tos-billing',
        dadosDepois: { path: ['outboxId'], equals: outboxId },
      },
    });
    if (dup) {
      this.logger.log(`Outbox ${outboxId} já faturado (idempotência)`);
      return;
    }

    await this.runBilling(payload, outboxId);
  }

  private async runBilling(payload: ContainerDispatchedPayload, outboxId: string): Promise<void> {
    this.logger.log(
      `Faturamento outbox ${outboxId}: container ${payload.numero} (${payload.diasEstadia} dias)`,
    );

    const periodo = `${payload.gateOutAt.getFullYear()}-${String(payload.gateOutAt.getMonth() + 1).padStart(2, '0')}`;
    const numeroIso = normalizeContainerIso(payload.numero);

    const gateInAg = await this.prisma.agendamentoTerminal.findUnique({
      where: { id: payload.agendamentoId },
    });

    const gateOutAg = await this.prisma.agendamentoTerminal.findFirst({
      where: {
        clienteId: payload.clienteId,
        numeroIso,
        tipoOperacao: TipoOperacaoAgendamento.GATE_OUT,
        status: { not: 'CANCELADO' },
        createdAt: { lte: payload.gateOutAt },
      },
      orderBy: { createdAt: 'desc' },
    });

    const reparos = await this.prisma.containerEvent.findMany({
      where: { containerId: payload.containerId, eventType: 'REPAIR_APPROVED' },
      orderBy: { createdAt: 'asc' },
    });

    const reeferPlugged = await this.prisma.containerEvent.count({
      where: { containerId: payload.containerId, eventType: 'REEFER_PLUGGED' },
    });

    const itens: { descricao: string; valor: number }[] = [
      {
        descricao: `Estadia depot — ${payload.numero} (${payload.diasEstadia} dia(s))`,
        valor: roundMoney(payload.diasEstadia * TARIFA_ESTADIA_DIA),
      },
      { descricao: `Lavagem — ${payload.numero}`, valor: TARIFA_LAVAGEM },
    ];

    if (gateInAg?.modalidadeTransporte === ModalidadeTransporte.FROTA_FL) {
      itens.push({
        descricao: `Frete de Coleta (First Mile) — ${payload.numero}`,
        valor: freightValue(gateInAg.valorFrete),
      });
    }

    if (gateOutAg?.modalidadeTransporte === ModalidadeTransporte.FROTA_FL) {
      itens.push({
        descricao: `Frete de Entrega (Last Mile) — ${payload.numero}`,
        valor: freightValue(gateOutAg.valorFrete),
      });
    }

    for (const rep of reparos) {
      const p = rep.payload as { valorReparo?: number; origem?: string };
      const valor = p.valorReparo ?? 0;
      if (valor > 0) {
        itens.push({
          descricao: `Reparo aprovado (${p.origem ?? 'N/A'}) — ${payload.numero}`,
          valor: roundMoney(valor),
        });
      }
    }

    if (payload.tipo === 'REEFER' && reeferPlugged > 0) {
      const setPoint = await this.resolveReeferSetPoint(payload);
      const energia = calculateReeferSurcharge(
        payload.diasEstadia,
        setPoint,
        TARIFA_REEFER_ENERGIA_DIA || DEFAULT_TARIFA_ENERGIA_REEFER_DIA,
      );
      itens.push({
        descricao: `Energia reefer — ${payload.numero} (${payload.diasEstadia} dia(s), set point ${setPoint}°C)`,
        valor: roundMoney(energia),
      });
    }

    const valorTotal = itens.reduce((s, i) => s + i.valor, 0);

    const faturamento = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.faturamento.findUnique({
        where: { clienteId_periodo: { clienteId: payload.clienteId, periodo } },
      });

      if (existing) {
        const updated = await tx.faturamento.update({
          where: { id: existing.id },
          data: {
            valorTotal: existing.valorTotal.add(new Prisma.Decimal(valorTotal.toFixed(2))),
            itens: {
              create: itens.map((i) => ({
                descricao: i.descricao,
                valor: new Prisma.Decimal(i.valor.toFixed(2)),
              })),
            },
          },
          include: { itens: true },
        });

        if (payload.solicitacaoId) {
          await tx.faturamentoSolicitacao.upsert({
            where: {
              faturamentoId_solicitacaoId: {
                faturamentoId: existing.id,
                solicitacaoId: payload.solicitacaoId,
              },
            },
            create: { faturamentoId: existing.id, solicitacaoId: payload.solicitacaoId },
            update: {},
          });
        }

        return updated;
      }

      return tx.faturamento.create({
        data: {
          clienteId: payload.clienteId,
          periodo,
          valorTotal: new Prisma.Decimal(valorTotal.toFixed(2)),
          itens: {
            create: itens.map((i) => ({
              descricao: i.descricao,
              valor: new Prisma.Decimal(i.valor.toFixed(2)),
            })),
          },
          ...(payload.solicitacaoId
            ? { solicitacoesVinculadas: { create: { solicitacaoId: payload.solicitacaoId } } }
            : {}),
        },
        include: { itens: true },
      });
    });

    await this.auditoria.registrar({
      tabela: 'faturamentos',
      registroId: faturamento.id,
      acao: AcaoAuditoria.INSERT,
      usuario: 'system:tos-billing',
      dadosDepois: {
        outboxId,
        containerId: payload.containerId,
        valorTotal,
        itens: itens.length,
      },
    });

    this.logger.log(`Fatura ${faturamento.id} — R$ ${valorTotal.toFixed(2)} (outbox ${outboxId})`);
  }

  private async resolveReeferSetPoint(payload: ContainerDispatchedPayload): Promise<number> {
    if (!payload.solicitacaoId) return 0;
    const cs = await this.prisma.containerSolicitacao.findFirst({
      where: {
        solicitacaoId: payload.solicitacaoId,
        unidade: { equals: normalizeContainerIso(payload.numero), mode: 'insensitive' },
      },
      select: { setPoint: true },
    });
    return cs?.setPoint ?? 0;
  }
}

function freightValue(valorFrete: Prisma.Decimal | null | undefined): number {
  if (valorFrete != null) return roundMoney(Number(valorFrete.toFixed(2)));
  return TARIFA_FRETE_DEFAULT;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
