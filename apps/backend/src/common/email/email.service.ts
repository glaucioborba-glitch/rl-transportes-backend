import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as handlebars from 'handlebars';
import * as nodemailer from 'nodemailer';
import { formatMailFrom } from './format-mail-from.util';
import { TenantAvisosService } from './tenant-avisos.service';
import { resolveAlertaDestinatarios } from './resolve-alerta-destinatarios.util';
import {
  resolveSmtpConfig,
  type ResolvedSmtpConfig,
  type SmtpEnvSnapshot,
} from './resolve-smtp-config.util';

export type EnvioAlertaResultado = {
  enviado: boolean;
  /** De onde veio a lista de destinatários. */
  origem: 'tenant' | 'env' | 'none';
  destinatarios: string[];
  motivo?: string;
};

export type SendPortalResetParams = {
  to: string;
  nomeCliente: string;
  resetUrl: string;
  logoUrl?: string;
  nomeEmpresa?: string;
};

export type SendFinanceiroNovoCadastroParams = {
  empresa: string;
  cnpj: string;
  email: string;
  validacaoDominio: string;
};

export type SendDunningNoticeParams = {
  to: string;
  subject: string;
  bodyText: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private compiledResetTemplate: ReturnType<typeof handlebars.compile> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly avisos: TenantAvisosService,
  ) {}

  private envFromFallback(): string {
    return this.config.get<string>('SMTP_FROM')?.trim() || 'RL Transportes <nao-responder@rl.com>';
  }

  private envSmtp(): SmtpEnvSnapshot {
    return {
      host: this.config.get<string>('SMTP_HOST'),
      port: this.config.get<string>('SMTP_PORT'),
      user: this.config.get<string>('SMTP_USER'),
      pass: this.config.get<string>('SMTP_PASS'),
    };
  }

  /** Remetente do tenant (parâmetros operacionais) ou SMTP_FROM do .env. */
  async resolveFrom(): Promise<string> {
    const params = await this.avisos.carregar();
    return formatMailFrom({
      email: params.emailEnvio,
      nome: params.emailEnvioNome,
      fallback: this.envFromFallback(),
    });
  }

  /** Remetente + SMTP (terminal primeiro, .env como fallback) prontos para envio. */
  private async resolveMailer(): Promise<{
    from: string;
    smtp: ResolvedSmtpConfig;
    emailsAlerta: string[];
  }> {
    const params = await this.avisos.carregar();
    return {
      from: formatMailFrom({
        email: params.emailEnvio,
        nome: params.emailEnvioNome,
        fallback: this.envFromFallback(),
      }),
      smtp: resolveSmtpConfig(this.envSmtp(), params.smtp),
      emailsAlerta: params.emailsAlerta,
    };
  }

  /** Destinatários dos avisos internos: lista do terminal ou .env do servidor. */
  private destinatariosAlerta(emailsAlerta: string[], smtpUser: string) {
    return resolveAlertaDestinatarios(emailsAlerta, {
      candidatos: [
        this.config.get<string>('FINANCEIRO_NOTIFY_EMAIL'),
        this.config.get<string>('SMTP_FINANCEIRO_TO'),
        smtpUser,
      ],
    });
  }

  private createTransport(smtp: ResolvedSmtpConfig) {
    return nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    });
  }

  /**
   * Aviso interno para a equipe do terminal (alertas do sistema).
   * Destino: lista de Parâmetros → Notificações, com o .env como reserva.
   */
  async sendAlertaInterno(params: {
    assunto: string;
    corpoTexto: string;
  }): Promise<EnvioAlertaResultado> {
    const { from, smtp, emailsAlerta } = await this.resolveMailer();
    const destino = this.destinatariosAlerta(emailsAlerta, smtp.user);

    if (!smtp.configurado || !destino.to) {
      return {
        enviado: false,
        origem: destino.origem,
        destinatarios: destino.destinatarios,
        motivo: !smtp.configurado ? 'SMTP não configurado' : 'sem destinatário de alerta',
      };
    }

    const html = `<p style="font-family:sans-serif;line-height:1.5">${params.corpoTexto.replace(/\n/g, '<br/>')}</p>`;
    try {
      await this.createTransport(smtp).sendMail({
        from,
        to: destino.to,
        subject: params.assunto,
        text: params.corpoTexto,
        html,
      });
      this.logger.log(`Alerta interno enviado para ${destino.to} (destino: ${destino.origem})`);
      return { enviado: true, origem: destino.origem, destinatarios: destino.destinatarios };
    } catch (e) {
      const motivo = e instanceof Error ? e.message : String(e);
      this.logger.error(`Falha ao enviar alerta interno: ${motivo}`);
      return {
        enviado: false,
        origem: destino.origem,
        destinatarios: destino.destinatarios,
        motivo,
      };
    }
  }

  /** Envia um e-mail de teste com a configuração atual do terminal. */
  async sendTeste(to: string): Promise<{ enviado: boolean; origem: ResolvedSmtpConfig['origem']; from: string; mensagem: string }> {
    const { from, smtp } = await this.resolveMailer();
    if (!smtp.configurado) {
      return {
        enviado: false,
        origem: smtp.origem,
        from,
        mensagem: 'Servidor SMTP não configurado. Preencha o servidor e a porta.',
      };
    }
    try {
      await this.createTransport(smtp).sendMail({
        from,
        to,
        subject: 'Teste de envio — RL Terminal',
        text: `Este é um e-mail de teste enviado pelo terminal.\n\nRemetente configurado: ${from}\nServidor: ${smtp.host}:${smtp.port}`,
        html: `<p style="font-family:sans-serif;line-height:1.5">Este é um e-mail de teste enviado pelo terminal.<br/>Remetente configurado: <strong>${from}</strong><br/>Servidor: ${smtp.host}:${smtp.port}</p>`,
      });
      this.logger.log(`E-mail de teste enviado para ${to} via ${smtp.host}:${smtp.port}`);
      return { enviado: true, origem: smtp.origem, from, mensagem: `E-mail de teste enviado para ${to}.` };
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : String(e);
      this.logger.error(`Falha no e-mail de teste para ${to}: ${mensagem}`);
      return { enviado: false, origem: smtp.origem, from, mensagem };
    }
  }

  private templatePath(): string {
    return path.join(__dirname, 'templates', 'reset-password.hbs');
  }

  private getCompiledTemplate() {
    if (this.compiledResetTemplate) return this.compiledResetTemplate;
    const p = this.templatePath();
    const src = fs.readFileSync(p, 'utf-8');
    this.compiledResetTemplate = handlebars.compile(src);
    return this.compiledResetTemplate;
  }

  /** HTML do e-mail de reset (útil para preview em desenvolvimento). */
  renderResetPasswordHtml(
    nomeCliente: string,
    resetUrl: string,
    extras?: { logoUrl?: string; nomeEmpresa?: string },
  ): string {
    const compile = this.getCompiledTemplate();
    return compile({
      nomeCliente,
      resetUrl,
      logoUrl: extras?.logoUrl ?? '',
      nomeEmpresa: extras?.nomeEmpresa ?? 'RL Transportes',
    });
  }

  async sendPortalPasswordReset(params: SendPortalResetParams): Promise<void> {
    const { from, smtp } = await this.resolveMailer();

    const html = this.renderResetPasswordHtml(params.nomeCliente, params.resetUrl, {
      logoUrl: params.logoUrl,
      nomeEmpresa: params.nomeEmpresa,
    });

    if (!smtp.configurado) {
      this.logger.warn(
        `[e-mail] SMTP não configurado — e-mail não enviado. Para: ${params.to} | Link: ${params.resetUrl}`,
      );
      return;
    }

    const transporter = this.createTransport(smtp);

    try {
      await transporter.sendMail({
        from,
        to: params.to,
        subject: `${params.nomeEmpresa || 'RL Transportes'} — Redefinir senha do portal`,
        html,
      });
      this.logger.log(`E-mail de recuperação enviado para ${params.to}`);
    } catch (e) {
      this.logger.error(`Falha ao enviar e-mail para ${params.to}: ${e instanceof Error ? e.message : e}`);
      throw e;
    }
  }

  async sendDunningNotice(params: SendDunningNoticeParams): Promise<void> {
    const { from, smtp } = await this.resolveMailer();

    const html = `<p style="font-family:sans-serif;line-height:1.5">${params.bodyText.replace(/\n/g, '<br/>')}</p>`;

    if (!smtp.configurado) {
      this.logger.warn(
        `[e-mail] SMTP não configurado — dunning não enviado. Para: ${params.to} | Assunto: ${params.subject}`,
      );
      return;
    }

    const transporter = this.createTransport(smtp);

    try {
      await transporter.sendMail({
        from,
        to: params.to,
        subject: params.subject,
        text: params.bodyText,
        html,
      });
      this.logger.log(`E-mail de cobrança (dunning) enviado para ${params.to}`);
    } catch (e) {
      this.logger.error(`Falha ao enviar dunning para ${params.to}: ${e instanceof Error ? e.message : e}`);
    }
  }

  /** Notifica setor financeiro sobre novo cadastro portal aguardando análise. */
  async sendFinanceiroNovoCadastro(params: SendFinanceiroNovoCadastroParams): Promise<void> {
    const bodyText = [
      `Novo cliente ${params.empresa} realizou cadastro e aguarda análise financeira.`,
      'Até a aprovação, o cliente já pode solicitar serviços com pagamento à vista (PIX).',
      '',
      `CNPJ/CPF: ${params.cnpj}`,
      `E-mail informado: ${params.email}`,
      `Validação de domínio: ${params.validacaoDominio}`,
      '',
      'Acesse Financeiro → Novos Cadastros Pendentes na intranet.',
    ].join('\n');

    const r = await this.sendAlertaInterno({
      assunto: `Novo cadastro portal — ${params.empresa}`,
      corpoTexto: bodyText,
    });
    if (!r.enviado) {
      this.logger.warn(
        `[e-mail] Alerta de novo cadastro não enviado (${r.motivo}). Empresa: ${params.empresa}`,
      );
    }
  }
}
