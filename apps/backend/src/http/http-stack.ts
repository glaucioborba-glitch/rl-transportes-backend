import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import compression = require('compression');
import cookieParser = require('cookie-parser');
import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { isAuthBruteForcePath } from '../common/http/auth-rate-limit-path.util';
import { csrfProtectionMiddleware } from '../common/middleware/csrf.middleware';
import { getGlobalRateLimitTiers, isProductionDeploy } from '../config/security.config';

function requestPath(req: Request): string {
  return (req as Request & { path?: string }).path || req.url?.split('?')[0] || '';
}

function shouldSkipRateLimit(req: Request): boolean {
  const p = requestPath(req);
  if (isAuthBruteForcePath(p)) return false;
  return (
    p === '/health' ||
    p === '/health/db' ||
    p.endsWith('/health') ||
    p.startsWith('/public/') ||
    p.startsWith('/marketplace/') ||
    p.startsWith('/gateway/')
  );
}

/** Helmet, cookies, CSRF opcional, rate limit, compressão — CORS global em `main.ts`. */
export function applyBaseHttpStack(app: INestApplication, logger?: Logger): void {
  const server = app.getHttpAdapter().getInstance();

  server.use(
    helmet({
      contentSecurityPolicy: isProductionDeploy()
        ? {
            directives: {
              defaultSrc: ["'none'"],
              frameAncestors: ["'none'"],
              baseUri: ["'none'"],
              formAction: ["'none'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
      // Frontend Next (:3000) e API (:3001) são origens distintas; <img> é no-cors.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  // Helmet default is CORP same-origin. Logos em <img> no Next (:3000) apontam para
  // a API (:3001) em modo no-cors — o browser bloqueia com NotSameOrigin.
  server.use((req: Request, res: Response, next: NextFunction) => {
    if (requestPath(req).startsWith('/public/')) {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
    next();
  });
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

  const authMax = isProductionDeploy() ? 10 : 30;
  server.use(
    rateLimit({
      windowMs: 60_000,
      max: authMax,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: 'Muitas tentativas de login. Aguarde um minuto.' },
      skip: (req) => !isAuthBruteForcePath(requestPath(req)),
    }),
  );

  logger?.log(
    `✓ Rate limit: GET ${tiers.read.max}/${tiers.read.windowMs}ms · mutações ${tiers.write.max}/${tiers.write.windowMs}ms · auth ${authMax}/60s`,
  );

  server.use(compression());
}
