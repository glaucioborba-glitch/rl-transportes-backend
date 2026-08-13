import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { catchError, finalize, tap, throwError } from 'rxjs';
import type { Observable } from 'rxjs';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { ObservabilidadeTelemetryStore } from './observabilidade-telemetry.store';
import { ObservabilityMetricsService } from '../observability/metrics.service';
import { ObservabilityLogsService } from '../observability/logs.service';

/** Captura latência — Redis em produção; Redis + in-memory em dev. */
@Injectable()
export class ObservabilidadeInterceptor implements NestInterceptor {
  constructor(
    private readonly store: ObservabilidadeTelemetryStore,
    private readonly obsMetrics: ObservabilityMetricsService,
    private readonly obsLogs: ObservabilityLogsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<
      Request & { requestId?: string; user?: AuthUser }
    >();
    const res = context.switchToHttp().getResponse<Response>();

    const rawPath = req.path ?? req.url?.split('?')[0] ?? '';
    if (rawPath.startsWith('/docs') || rawPath.startsWith('/favicon')) {
      return next.handle();
    }

    const start = Date.now();
    let handledError = false;

    const record = (statusCode: number) => {
      const durationMs = Date.now() - start;
      const requestId = req.requestId ?? req.headers['x-request-id']?.toString() ?? 'unknown';

      void this.obsMetrics.recordHttpRoundtrip({
        path: rawPath,
        method: req.method,
        statusCode,
        durationMs,
        usuarioId: req.user?.id,
      });

      if (statusCode >= 400) {
        void this.obsLogs.recordException({
          path: rawPath,
          message:
            statusCode >= 500
              ? `HTTP ${statusCode} (${durationMs}ms)`
              : `HTTP ${statusCode}`,
          statusCode,
          level: statusCode >= 500 ? 'ERROR' : 'WARNING',
        });
      }

      this.store.registrarHttpRoundtrip({
        requestId,
        path: rawPath,
        method: req.method,
        statusCode,
        durationMs,
        usuarioId: req.user?.id,
        usuarioEmail: req.user?.email,
        clienteId: req.user?.clienteId ?? undefined,
      });
    };

    return next.handle().pipe(
      tap({
        error: (err: unknown) => {
          handledError = true;
          record(err instanceof HttpException ? err.getStatus() : 500);
        },
      }),
      catchError((err: unknown) => throwError(() => err)),
      finalize(() => {
        if (handledError) return;
        const statusCode =
          typeof res.statusCode === 'number' && res.statusCode > 0 ? res.statusCode : 500;
        record(statusCode);
      }),
    );
  }
}
