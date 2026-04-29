import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import type { PlataformaHttpReq } from '../guards/plataforma-public-auth.guard';
import { PlataformaConsumptionStore } from '../stores/plataforma-consumption.store';

@Injectable()
export class PlataformaConsumoInterceptor implements NestInterceptor {
  constructor(private readonly consumo: PlataformaConsumptionStore) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<PlataformaHttpReq>();
    const res = ctx.switchToHttp().getResponse<{ statusCode?: number }>();
    const t0 = Date.now();
    const path = (req as { path?: string }).path ?? '';

    return next.handle().pipe(
      tap(() => {
        const cliente = req.plataformaCliente;
        if (!cliente) return;
        this.consumo.registrar({
          apiClientId: cliente.id,
          rota: path,
          metodo: (req as { method?: string }).method ?? 'GET',
          statusHttp: res.statusCode ?? 200,
          latencyMs: Date.now() - t0,
          tenantId: req.plataformaTenantId ?? cliente.tenantId,
        });
      }),
      catchError((err) => {
        const cliente = req.plataformaCliente;
        if (cliente) {
          const status = err instanceof HttpException ? err.getStatus() : (err?.status ?? 500);
          this.consumo.registrar({
            apiClientId: cliente.id,
            rota: path,
            metodo: (req as { method?: string }).method ?? 'GET',
            statusHttp: status,
            latencyMs: Date.now() - t0,
            tenantId: req.plataformaTenantId ?? null,
          });
        }
        return throwError(() => err);
      }),
    );
  }
}
