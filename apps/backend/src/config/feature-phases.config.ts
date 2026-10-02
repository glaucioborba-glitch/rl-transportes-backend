import { registerAs } from '@nestjs/config';

/**
 * Fases de deploy (H4).
 * - full (default): todos os bounded contexts
 * - operational | lean: Gate + Pátio + Billing + Portal (memória reduzida no boot)
 */
export default registerAs('featurePhases', () => {
  const raw = (process.env.FEATURE_PHASES ?? 'full').toLowerCase().trim();
  const lean = raw === 'operational' || raw === 'lean' || raw === '0';
  return {
    mode: lean ? ('operational' as const) : ('full' as const),
    lean,
    analyticsLazy: process.env.FEATURE_ANALYTICS_LAZY !== '0',
    billingCronLazy:
      process.env.FEATURE_BILLING_CRON_LAZY === '1' ||
      (process.env.FEATURE_BILLING_CRON_LAZY !== '0' && lean),
  };
});
