import { createHmac } from 'crypto';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';

/** Assinatura HMAC-SHA256 do JSON de resposta (rotas financeiro/fiscal críticas). */
@Injectable()
export class PlataformaHmacResponseInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const sec = process.env.PLATAFORMA_HMAC_SECRET ?? '';
    const res = ctx.switchToHttp().getResponse<{ setHeader: (k: string, v: string) => void }>();
    return next.handle().pipe(
      tap((data: unknown) => {
        if (!sec) return;
        const raw = typeof data === 'string' ? data : JSON.stringify(data ?? {});
        const sig = createHmac('sha256', sec).update(raw).digest('hex');
        res.setHeader('X-Response-Signature', `sha256=${sig}`);
      }),
      catchError((err) => throwError(() => err)),
    );
  }
}
