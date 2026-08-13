import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { DEFAULT_TENANT_ID } from '../tenant/tenant.constants';
import { AuditContextService } from './audit-context.service';

@Injectable()
export class AuditTrailInterceptor implements NestInterceptor {
  constructor(private readonly auditContext: AuditContextService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser; tenantId?: string }>();
    const user = req.user;

    if (!user?.id) {
      return next.handle();
    }

    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      undefined;

    return this.auditContext.run(
      {
        tenantId: req.tenantId ?? DEFAULT_TENANT_ID,
        usuarioId: user.id,
        usuarioNome: user.email?.split('@')[0] ?? user.id.slice(0, 8),
        usuarioRole: String(user.role),
        ipAddress: ip,
      },
      () => next.handle(),
    );
  }
}
