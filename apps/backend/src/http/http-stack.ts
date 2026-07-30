import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import compression = require('compression');
import cookieParser = require('cookie-parser');
import type { Request } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { csrfProtectionMiddleware } from '../common/middleware/csrf.middleware';
import { getGlobalRateLimitTiers } from '../config/security.config';

function shouldSkipRateLimit(req: Request): boolean {
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
}

/** Helmet, cookies, CSRF opcional, rate limit, compressão — CORS global em `main.ts`. */
export function applyBaseHttpStack(app: INestApplication, logger?: Logger): void {
  const server = app.getHttpAdapter().getInstance();

  server.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  server.use(cookieParser());
  server.use(csrfProtectionMiddleware());

  const tiers = getGlobalRateLimitTiers();
  const rateMessage = {
    message: 'Muitas requisições deste IP. Tente novamente em instantes.',
  };

  server.use(
    rateLimit({
      windowMs: tiers.read.windowMs,
      max: tiers.read.max,
      standardHeaders: true,
      legacyHeaders: false,
      message: rateMessage,
      skip: (req) => shouldSkipRateLimit(req) || req.method !== 'GET',
    }),
  );

  server.use(
    rateLimit({
      windowMs: tiers.write.windowMs,
      max: tiers.write.max,
      standardHeaders: true,
      legacyHeaders: false,
      message: rateMessage,
      skip: (req) => shouldSkipRateLimit(req) || req.method === 'GET',
    }),
  );

  logger?.log(
    `✓ Rate limit: GET ${tiers.read.max}/${tiers.read.windowMs}ms · mutações ${tiers.write.max}/${tiers.write.windowMs}ms`,
  );

  server.use(compression());
}
