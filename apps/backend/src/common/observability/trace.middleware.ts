import { Injectable, NestMiddleware } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { NextFunction, Request, Response } from 'express';
import { CORRELATION_HEADER, TRACE_ID_KEY } from './trace.constants';
import { resolveTraceId } from './trace-id.util';

export type TraceAwareRequest = Request & { traceId: string; requestId: string };

@Injectable()
export class TraceMiddleware implements NestMiddleware {
  constructor(private readonly cls: ClsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const traceId = resolveTraceId(req);

    this.cls.run(() => {
      this.cls.set(TRACE_ID_KEY, traceId);
      const traced = req as TraceAwareRequest;
      traced.traceId = traceId;
      traced.requestId = traceId;
      res.setHeader('X-Correlation-ID', traceId);
      res.setHeader(CORRELATION_HEADER, traceId);
      res.setHeader('X-Request-ID', traceId);
      next();
    });
  }
}
