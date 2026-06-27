import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { CxPortalRateLimitService } from '../security/cx-portal-rate-limit.service';
import type { CxPortalRequestUser } from '../types/cx-portal.types';

@Injectable()
export class CxPortalRateLimitGuard implements CanActivate {
  constructor(private readonly limiter: CxPortalRateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { cxUser?: CxPortalRequestUser }>();
    const raw = (req as Request & { path?: string }).path || req.url || '';
    if (raw.includes('minhas-permissoes')) {
      return true;
    }
    await this.limiter.poke(req, req.cxUser);
    return true;
  }
}
