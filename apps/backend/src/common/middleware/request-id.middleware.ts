import type { NextFunction, Request, Response } from 'express';
import { resolveTraceId } from '../observability/trace-id.util';

/** @deprecated Prefer TraceMiddleware + ClsService — mantido para compatibilidade. */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = resolveTraceId(req);
  (req as Request & { requestId: string }).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  res.setHeader('X-Correlation-ID', requestId);
  next();
}
