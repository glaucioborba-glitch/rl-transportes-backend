import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { CORRELATION_HEADER } from './trace.constants';

export function resolveTraceId(req: Request): string {
  const raw = req.headers[CORRELATION_HEADER] ?? req.headers['x-request-id'];
  const headerVal = Array.isArray(raw) ? raw[0] : raw;
  if (typeof headerVal === 'string' && headerVal.trim().length > 0) {
    return headerVal.trim();
  }
  return randomUUID();
}
