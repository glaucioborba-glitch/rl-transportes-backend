import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import type { Request } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { getCorsOrigins } from '../config/security.config';
import { csrfProtectionMiddleware } from '../common/middleware/csrf.middleware';

const CORS_METHODS = ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'] as const;

const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Request-Id',
  'X-Request-ID',
  'X-Api-Key',
  'X-Public-Api-Key',
  'X-Public-Api-Secret',
  'X-Tenant-ID',
  'X-Integracao-Interno',
  'X-Integracao-Signature',
  'X-Mobile-Critical-Pin',
  'X-RL-Auth-Cookie',
  'X-CSRF-Token',
];

/** Helmet, cookies, CSRF opcional, rate limit, CORS por env, compressão — espelha produção nos e2e que chamarem esta função. */
export function applyBaseHttpStack(app: INestApplication, logger?: Logger): void {
  const server = app.getHttpAdapter().getInstance();

  server.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  server.use(cookieParser());
  server.use(csrfProtectionMiddleware());

  const rateMax = Math.max(1, parseInt(process.env.RATE_LIMIT_MAX || '100', 10) || 100);
  server.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: rateMax,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        message: 'Muitas requisições de seu IP, tente novamente após 15 minutos.',
      },
      skip: (req: Request) => {
        const p = (req as Request & { path?: string }).path || req.url?.split('?')[0] || '';
        return (
          p === '/health' ||
          p.endsWith('/health') ||
          p.startsWith('/public/') ||
          p.startsWith('/marketplace/') ||
          p.startsWith('/gateway/') ||
          p.startsWith('/mobile/')
        );
      },
    }),
  );

  const origins = getCorsOrigins();
  if (logger && origins.length) {
    logger.log(`CORS permitidas: ${origins.join(', ')}`);
  }

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean | string) => void) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (origins.includes(origin)) {
        callback(null, origin);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: [...CORS_METHODS],
    allowedHeaders: [...ALLOWED_HEADERS],
  });

  server.use(compression());
}
