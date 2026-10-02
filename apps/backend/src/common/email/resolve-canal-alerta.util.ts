export type WebhookAlertaTenant = {
  url?: string;
  habilitado: boolean;
};

export type ResolvedWebhookAlerta = {
  /** 'tenant' = Parâmetros → Notificações; 'env' = ALERT_WEBHOOK_URL. */
  origem: 'tenant' | 'env' | 'none';
  url: string;
};

/**
 * Webhook dos alertas: o do terminal manda quando estiver habilitado;
 * senão vale o do .env do servidor.
 */
export function resolveWebhookAlerta(
  tenant: WebhookAlertaTenant | undefined,
  envUrl: string | undefined,
): ResolvedWebhookAlerta {
  const doTenant = tenant?.habilitado ? (tenant.url?.trim() ?? '') : '';
  if (doTenant) return { origem: 'tenant', url: doTenant };
  const doEnv = envUrl?.trim() ?? '';
  return doEnv ? { origem: 'env', url: doEnv } : { origem: 'none', url: '' };
}

const DEBOUNCE_PADRAO_MS = 15 * 60 * 1000;

/**
 * Intervalo mínimo entre dois alertas iguais. O terminal configura em minutos;
 * o .env, em milissegundos.
 */
export function resolveDebounceAlertaMs(
  debounceTenantMin: number | undefined,
  envMs: string | undefined,
): number {
  const minutos = Number(debounceTenantMin);
  if (Number.isFinite(minutos) && minutos > 0) {
    return Math.round(minutos) * 60 * 1000;
  }
  const ms = envMs ? parseInt(envMs, 10) : NaN;
  return Number.isFinite(ms) && ms > 0 ? ms : DEBOUNCE_PADRAO_MS;
}
