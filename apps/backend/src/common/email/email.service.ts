import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as handlebars from 'handlebars';
import * as nodemailer from 'nodemailer';

export type SendPortalResetParams = {
  to: string;
  nomeCliente: string;
  resetUrl: string;
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

  constructor(private readonly config: ConfigService) {}

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
  renderResetPasswordHtml(nomeCliente: string, resetUrl: string): string {
    const compile = this.getCompiledTemplate();
    return compile({ nomeCliente, resetUrl });
  }

  async sendPortalPasswordReset(params: SendPortalResetParams): Promise<void> {
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    const port = parseInt(this.config.get<string>('SMTP_PORT') || '587', 10) || 587;
    const user = this.config.get<string>('SMTP_USER')?.trim();
    const pass = this.config.get<string>('SMTP_PASS') ?? '';
    const from = this.config.get<string>('SMTP_FROM')?.trim() || 'RL Transportes <nao-responder@rl.com>';

    const html = this.renderResetPasswordHtml(params.nomeCliente, params.resetUrl);

    if (!host) {
      this.logger.warn(
        `[e-mail] SMTP_HOST não definido — e-mail não enviado. Para: ${params.to} | Link: ${params.resetUrl}`,
      );
      return;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
    });

    try {
      await transporter.sendMail({
        from,
        to: params.to,
        subject: 'RL Transportes — Redefinir senha do portal',
        html,
      });
      this.logger.log(`E-mail de recuperação enviado para ${params.to}`);
    } catch (e) {
      this.logger.error(`Falha ao enviar e-mail para ${params.to}: ${e instanceof Error ? e.message : e}`);
      throw e;
    }
  }

  async sendDunningNotice(params: SendDunningNoticeParams): Promise<void> {
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    const port = parseInt(this.config.get<string>('SMTP_PORT') || '587', 10) || 587;
    const user = this.config.get<string>('SMTP_USER')?.trim();
    const pass = this.config.get<string>('SMTP_PASS') ?? '';
    const from = this.config.get<string>('SMTP_FROM')?.trim() || 'RL Transportes <nao-responder@rl.com>';

    const html = `<p style="font-family:sans-serif;line-height:1.5">${params.bodyText.replace(/\n/g, '<br/>')}</p>`;

    if (!host) {
      this.logger.warn(
        `[e-mail] SMTP_HOST não definido — dunning não enviado. Para: ${params.to} | Assunto: ${params.subject}`,
      );
      return;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
    });

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
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    const port = parseInt(this.config.get<string>('SMTP_PORT') || '587', 10) || 587;
    const user = this.config.get<string>('SMTP_USER')?.trim();
    const pass = this.config.get<string>('SMTP_PASS') ?? '';
    const from = this.config.get<string>('SMTP_FROM')?.trim() || 'RL Transportes <nao-responder@rl.com>';
    const to =
      this.config.get<string>('FINANCEIRO_NOTIFY_EMAIL')?.trim() ||
      this.config.get<string>('SMTP_FINANCEIRO_TO')?.trim() ||
      user ||
      '';

    const assunto = `Novo cadastro portal — ${params.empresa}`;
    const bodyText = [
      `Novo cliente ${params.empresa} realizou cadastro e aguarda análise financeira.`,
      '',
      `CNPJ/CPF: ${params.cnpj}`,
      `E-mail informado: ${params.email}`,
      `Validação de domínio: ${params.validacaoDominio}`,
      '',
      'Acesse Financeiro → Novos Cadastros Pendentes na intranet.',
    ].join('\n');
    const html = `<p style="font-family:sans-serif;line-height:1.5">${bodyText.replace(/\n/g, '<br/>')}</p>`;

    if (!host || !to) {
      this.logger.warn(
        `[e-mail] SMTP ou FINANCEIRO_NOTIFY_EMAIL não definido — alerta cadastro não enviado. Empresa: ${params.empresa}`,
      );
      return;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
    });

    try {
      await transporter.sendMail({ from, to, subject: assunto, text: bodyText, html });
      this.logger.log(`Alerta financeiro (novo cadastro) enviado para ${to}`);
    } catch (e) {
      this.logger.error(
        `Falha ao enviar alerta financeiro cadastro: ${e instanceof Error ? e.message : e}`,
      );
    }
  }
}
