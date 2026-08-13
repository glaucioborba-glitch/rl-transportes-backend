import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AUDIT_ACAO_WHATSAPP_SENT,
  AUDIT_ENTIDADE_NOTIFICACAO,
  type WhatsappNotifyPayload,
} from './notification.constants';
import { buildDunningMessage } from '../common/finance/regua-cobranca.util';
import { EstagioCobranca } from '@prisma/client';
import { NotificationRecipientService } from './notification-recipient.service';
import { maskPhoneE164 } from './whatsapp-phone.util';
import { WhatsappService } from './whatsapp.service';

function formatBrl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateTimePt(iso: string | undefined): string {
  if (!iso) return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

@Injectable()
export class WhatsappOutboxProcessor {
  private readonly logger = new Logger(WhatsappOutboxProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly recipients: NotificationRecipientService,
    private readonly auditLog: AuditLogService,
    private readonly config: ConfigService,
  ) {}

  async processWhatsappNotify(outboxId: string, raw: unknown): Promise<void> {
    const payload = raw as WhatsappNotifyPayload;
    if (!payload?.kind || !payload.dedupeKey) {
      throw new Error('Payload WHATSAPP_NOTIFY inválido');
    }

    const dup = await this.prisma.auditLog.findFirst({
      where: {
        entidadeTipo: AUDIT_ENTIDADE_NOTIFICACAO,
        acao: AUDIT_ACAO_WHATSAPP_SENT,
        dadosNovos: { path: ['dedupeKey'], equals: payload.dedupeKey },
      },
    });
    if (dup) {
      this.logger.log(`WhatsApp outbox ${outboxId} já processado (dedupe=${payload.dedupeKey})`);
      return;
    }

    if (payload.kind === 'FINANCEIRO_FATURA') {
      await this.processFinanceiro(outboxId, payload);
      return;
    }

    if (payload.kind === 'DUNNING_COBRANCA') {
      await this.processDunning(outboxId, payload);
      return;
    }

    await this.processOperacional(outboxId, payload);
  }

  private async processOperacional(outboxId: string, payload: WhatsappNotifyPayload): Promise<void> {
    if (!payload.solicitacaoId) throw new Error('solicitacaoId obrigatório para notificação operacional');

    const recipient = await this.recipients.resolveOperacionalBySolicitacao(payload.solicitacaoId);
    if (!recipient) {
      this.logger.warn(
        `WhatsApp operacional ignorado — sem telefone válido (solicitação ${payload.solicitacaoId})`,
      );
      return;
    }

    const iso = payload.containerIso || recipient.containerIso;
    const protocolo = payload.protocolo || recipient.protocolo;
    const when = formatDateTimePt(payload.eventAt);
    const templateName = this.config.get<string>('whatsapp.templateOperacional') ?? 'rl_operacional_armazenamento';

    const bodyText =
      payload.kind === 'OPERACIONAL_ARMAZENADO'
        ? `Olá, ${recipient.nome}. A unidade ${iso} referente ao protocolo ${protocolo} deu entrada e foi armazenada com sucesso no terminal RL Transportes em ${when}.`
        : `Olá, ${recipient.nome}. A unidade ${iso} referente ao protocolo ${protocolo} deu entrada no terminal RL Transportes em ${when}.`;

    const result = await this.whatsapp.sendTemplate({
      toE164: recipient.telefoneE164,
      templateName,
      bodyParameters: [recipient.nome, iso, protocolo, when],
    });

    await this.auditLog.append({
      entidadeId: payload.solicitacaoId,
      entidadeTipo: AUDIT_ENTIDADE_NOTIFICACAO,
      acao: AUDIT_ACAO_WHATSAPP_SENT,
      usuarioId: 'system:whatsapp',
      usuarioNome: 'Motor de Notificações WhatsApp',
      usuarioRole: 'SYSTEM',
      dadosNovos: {
        dedupeKey: payload.dedupeKey,
        outboxId,
        kind: payload.kind,
        telefone: maskPhoneE164(recipient.telefoneE164),
        template: templateName,
        messageId: result.messageId,
        mode: result.mode,
        preview: bodyText,
      },
    });
  }

  private async processFinanceiro(outboxId: string, payload: WhatsappNotifyPayload): Promise<void> {
    if (!payload.clienteId || !payload.faturaId) {
      throw new Error('clienteId/faturaId obrigatórios para notificação financeira');
    }

    const recipient = await this.recipients.resolveFinanceiroByCliente(payload.clienteId);
    if (!recipient) {
      this.logger.warn(
        `WhatsApp financeiro ignorado — sem telefone válido (cliente ${payload.clienteId})`,
      );
      return;
    }

    const valor = formatBrl(payload.valorTotal ?? 0);
    const iso = payload.containerIso;
    const link = payload.portalLink ?? `${this.config.get<string>('whatsapp.portalPublicBaseUrl')}/portal/financeiro`;
    const templateName = this.config.get<string>('whatsapp.templateFinanceiro') ?? 'rl_financeiro_fatura_consolidada';

    const bodyText = `Olá. O faturamento da operação do contêiner ${iso} foi concluído. Sua NFS-e e o Boleto no valor de ${valor} já estão disponíveis. Acesse rapidamente pelo link seguro: ${link}.`;

    const result = await this.whatsapp.sendTemplate({
      toE164: recipient.telefoneE164,
      templateName,
      bodyParameters: [iso, valor, link],
    });

    await this.auditLog.append({
      entidadeId: payload.faturaId,
      entidadeTipo: AUDIT_ENTIDADE_NOTIFICACAO,
      acao: AUDIT_ACAO_WHATSAPP_SENT,
      usuarioId: 'system:whatsapp',
      usuarioNome: 'Motor de Notificações WhatsApp',
      usuarioRole: 'SYSTEM',
      dadosNovos: {
        dedupeKey: payload.dedupeKey,
        outboxId,
        kind: payload.kind,
        telefone: maskPhoneE164(recipient.telefoneE164),
        template: templateName,
        messageId: result.messageId,
        mode: result.mode,
        preview: bodyText,
      },
    });
  }

  private async processDunning(outboxId: string, payload: WhatsappNotifyPayload): Promise<void> {
    if (!payload.clienteId || !payload.faturaId || !payload.dunningStage) {
      throw new Error('clienteId/faturaId/dunningStage obrigatórios para dunning');
    }

    const recipient = await this.recipients.resolveFinanceiroByCliente(payload.clienteId);
    if (!recipient) {
      this.logger.warn(
        `WhatsApp dunning ignorado — sem telefone válido (cliente ${payload.clienteId})`,
      );
      return;
    }

    const stage = payload.dunningStage as EstagioCobranca;
    const valor = payload.valorTotal ?? 0;
    const link = payload.portalLink ?? `${this.config.get<string>('whatsapp.portalPublicBaseUrl')}/portal/financeiro`;
    const faturaNumero = payload.faturaNumero ?? payload.faturaId.slice(0, 8).toUpperCase();
    const dataVenc = payload.dataVencimento ? new Date(payload.dataVencimento) : new Date();
    const bodyText =
      payload.messagePreview ??
      buildDunningMessage(stage, {
        faturaNumero,
        valorExibicao: valor,
        dataVencimento: dataVenc,
        portalLink: link,
        diasAtraso: payload.diasAtraso ?? 0,
      });

    const templateName =
      this.config.get<string>('whatsapp.templateDunning') ?? 'rl_financeiro_dunning';

    const result = await this.whatsapp.sendTemplate({
      toE164: recipient.telefoneE164,
      templateName,
      bodyParameters: [faturaNumero, formatBrl(valor), link],
    });

    await this.auditLog.append({
      entidadeId: payload.faturaId,
      entidadeTipo: AUDIT_ENTIDADE_NOTIFICACAO,
      acao: AUDIT_ACAO_WHATSAPP_SENT,
      usuarioId: 'system:whatsapp',
      usuarioNome: 'Motor de Cobrança (Dunning)',
      usuarioRole: 'SYSTEM',
      dadosNovos: {
        dedupeKey: payload.dedupeKey,
        outboxId,
        kind: payload.kind,
        dunningStage: payload.dunningStage,
        telefone: maskPhoneE164(recipient.telefoneE164),
        template: templateName,
        messageId: result.messageId,
        mode: result.mode,
        preview: bodyText,
      },
    });
  }
}
