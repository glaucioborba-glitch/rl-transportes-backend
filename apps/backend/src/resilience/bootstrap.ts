import type { INestApplication } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { matchResilienceRule } from './resilience-path.util';

/** Anota perfil de isolamento para debugging/proxy (opcional). */
export function attachResilienceRouteHints(app: INestApplication): void {
  const server = app.getHttpAdapter().getInstance() as {
    use: (fn: (req: Request, res: Response, next: NextFunction) => void) => void;
  };
  server.use((req: Request & { resilienceHint?: string }, _res: Response, next: NextFunction) => {
    const path = req.path ?? req.url?.split('?')[0] ?? '';
    const rule = matchResilienceRule(path);
    req.resilienceHint = rule ? `${rule.service}:${rule.timeoutMs}ms` : '';
    next();
  });
}
