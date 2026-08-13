import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Role, TenantStatus } from '@prisma/client';
import { Observable } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from './tenant-context.service';

type AuthUser = {
  role?: Role;
  tenantId?: string | null;
  sub?: string;
};

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly prisma: PrismaService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest<{ user?: AuthUser; tenantId?: string }>();
    const user = req.user;
    const role = user?.role;
    const tenantId = user?.tenantId ?? req.tenantId ?? 'default';

    if (role && role !== Role.SUPER_ADMIN) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant || tenant.status === TenantStatus.BLOQUEADO) {
        throw new ForbiddenException('Terminal bloqueado ou inexistente');
      }
      if (tenant.status === TenantStatus.SUSPENSO) {
        throw new ForbiddenException('Terminal suspenso — contate o suporte');
      }
    }

    const state = this.tenantContext.setFromAuth(role ?? Role.CLIENTE, tenantId);
    req.tenantId = state.tenantId ?? tenantId;

    return new Observable((subscriber) => {
      this.tenantContext.run(state, () => {
        next.handle().subscribe({
          next: (v) => subscriber.next(v),
          error: (e) => subscriber.error(e),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
