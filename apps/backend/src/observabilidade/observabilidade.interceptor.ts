import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { finalize } from 'rxjs';
import type { Observable } from 'rxjs';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { ObservabilidadeTelemetryStore } from './observabilidade-telemetry.store';

/** Captura latência e correlaciona requestId para logs/métricas/tracing (somente leitura no armazenamento). */
@Injectable()
export class ObservabilidadeInterceptor implements NestInterceptor {
  constructor(private readonly store: ObservabilidadeTelemetryStore) {}

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

    return next.handle().pipe(
      finalize(() => {
        const durationMs = Date.now() - start;
        const statusCode =
          typeof res.statusCode === 'number' && res.statusCode > 0 ? res.statusCode : 500;
        const requestId = req.requestId ?? req.headers['x-request-id']?.toString() ?? 'unknown';

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
      }),
    );
  }
}
