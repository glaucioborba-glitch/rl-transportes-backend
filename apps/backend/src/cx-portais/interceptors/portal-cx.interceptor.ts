import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request } from 'express';
import { PortalAnalyticsStore } from '../stores/portal-analytics.store';
import type { CxPortalRequestUser } from '../types/cx-portal.types';

@Injectable()
export class PortalCxInterceptor implements NestInterceptor {
  constructor(private readonly analytics: PortalAnalyticsStore) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request & { cxUser?: CxPortalRequestUser }>();
    const t0 = Date.now();
    return next.handle().pipe(
      tap(() => {
        const u = req.cxUser;
        if (!u) return;
        this.analytics.registrar({
          path: `${req.method} ${req.path}`,
          sub: u.sub,
          portalPapel: u.portalPapel,
          tenantId: u.tenantId,
          at: Date.now(),
          tempoMs: Date.now() - t0,
        });
      }),
    );
  }
}
