import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const raw = req.headers['x-request-id'];
  const headerVal = Array.isArray(raw) ? raw[0] : raw;
  const requestId = (typeof headerVal === 'string' && headerVal.length > 0 ? headerVal : null) ?? randomUUID();
  (req as Request & { requestId: string }).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}
