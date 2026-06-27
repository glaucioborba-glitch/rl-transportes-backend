export type AlertSeverity = 'warning' | 'critical';

export type AlertPayload = {
  key: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  traceId?: string;
  meta?: Record<string, unknown>;
};

export const ALERT_KEYS = {
  FISCAL_IPM_DOWN: 'fiscal_ipm_down',
  OUTBOX_NFSE_CONSECUTIVE_FAILURES: 'outbox_nfse_consecutive_failures',
  GATE_QR_SLOW: 'gate_qr_slow',
} as const;
