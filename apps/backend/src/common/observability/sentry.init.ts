import * as Sentry from '@sentry/node';

let initialized = false;

/** Inicializa Sentry antes do bootstrap Nest (no-op sem SENTRY_DSN). */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn || initialized) return;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    release: process.env.SENTRY_RELEASE,
    /** 100% das exceções capturadas pelo SDK. */
    sampleRate: 1.0,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.2'),
    enableLogs: true,
  });

  initialized = true;
}
