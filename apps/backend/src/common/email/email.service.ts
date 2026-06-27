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
}
