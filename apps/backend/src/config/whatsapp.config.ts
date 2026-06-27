import { registerAs } from '@nestjs/config';

/** WhatsApp Business API (Meta Cloud API ou compatível). */
export default registerAs('whatsapp', () => ({
  enabled: (process.env.WHATSAPP_ENABLED ?? 'false').toLowerCase() === 'true',
  provider: (process.env.WHATSAPP_PROVIDER ?? 'meta').toLowerCase(),
  apiBaseUrl: (process.env.WHATSAPP_API_BASE_URL ?? 'https://graph.facebook.com/v19.0').replace(/\/$/, ''),
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
  /** Nomes dos templates aprovados na Meta (Message Templates). */
  templateOperacional: process.env.WHATSAPP_TEMPLATE_OPERACIONAL ?? 'rl_operacional_armazenamento',
  templateFinanceiro: process.env.WHATSAPP_TEMPLATE_FINANCEIRO ?? 'rl_financeiro_fatura_consolidada',
  /** URL pública do portal para links em mensagens financeiras. */
  portalPublicBaseUrl:
    process.env.PORTAL_PUBLIC_BASE_URL ??
    process.env.FRONTEND_ORIGIN ??
    process.env.CORS_ORIGIN ??
    'http://localhost:3000',
}));
