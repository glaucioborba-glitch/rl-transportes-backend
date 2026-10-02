import { registerAs } from '@nestjs/config';

/** Integração bancária (boleto + PIX) — Itaú / Inter / Cora ou sandbox local. */
export default registerAs('banking', () => ({
  provider: (process.env.BANK_PROVIDER ?? 'sandbox').toLowerCase(),
  apiBaseUrl: process.env.BANK_API_BASE_URL ?? '',
  apiToken: process.env.BANK_API_TOKEN ?? '',
  clientId: process.env.BANK_CLIENT_ID ?? '',
  clientSecret: process.env.BANK_CLIENT_SECRET ?? '',
  /** Dias úteis/corridos para vencimento padrão do boleto de armazenagem. */
  vencimentoDias: Number(process.env.BANK_BOLETO_VENCIMENTO_DIAS ?? '7') || 7,
  /** URL base pública para links de boleto/PIX em sandbox (portal). */
  sandboxPublicBaseUrl:
    process.env.BANK_SANDBOX_PUBLIC_BASE_URL ?? 'http://localhost:3000/portal/financeiro',
}));
