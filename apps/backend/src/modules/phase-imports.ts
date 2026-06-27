import type { Type } from '@nestjs/common';
import { AnalyticsDomainModule } from './analytics/analytics-domain.module';
import { AnalyticsLazyModule } from './analytics/analytics-lazy.module';
import { BillingLazyModule } from './billing/billing-lazy.module';
import { EnterpriseDomainModule } from './enterprise/enterprise-domain.module';

/**
 * Módulos opcionais conforme FEATURE_PHASES.
 * operational | lean → só bounded contexts críticos (Gate, Pátio, Billing, Portal).
 */
export function resolvePhaseImports(): Type[] {
  const phase = (process.env.FEATURE_PHASES ?? 'full').toLowerCase().trim();
  const lean = phase === 'operational' || phase === 'lean' || phase === '0';
  if (lean) {
    return [BillingLazyModule];
  }

  const modules: Type[] = [EnterpriseDomainModule];
  const analyticsLazy = process.env.FEATURE_ANALYTICS_LAZY !== '0';
  if (analyticsLazy) {
    modules.unshift(AnalyticsLazyModule);
  } else {
    modules.unshift(AnalyticsDomainModule);
  }
  if (isBillingCronLazy()) {
    modules.push(BillingLazyModule);
  }
  return modules;
}

export function isOperationalPhase(): boolean {
  const phase = (process.env.FEATURE_PHASES ?? 'full').toLowerCase().trim();
  return phase === 'operational' || phase === 'lean' || phase === '0';
}

/** CRON de provisão diária carregado sob demanda (H4 lazy boot). */
export function isBillingCronLazy(): boolean {
  if (process.env.FEATURE_BILLING_CRON_LAZY === '1') return true;
  if (process.env.FEATURE_BILLING_CRON_LAZY === '0') return false;
  return isOperationalPhase();
}
