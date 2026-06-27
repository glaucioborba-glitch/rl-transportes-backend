import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import type { Request } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { csrfProtectionMiddleware } from '../common/middleware/csrf.middleware';

/** Helmet, cookies, CSRF opcional, rate limit, compressão — CORS global em `main.ts`. */
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
          p.startsWith('/mobile/') ||
          p.startsWith('/portal/auth/')
        );
      },
    }),
  );

  server.use(compression());
}
