import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { CxPortalRateLimitService } from '../security/cx-portal-rate-limit.service';
import type { CxPortalRequestUser } from '../types/cx-portal.types';

@Injectable()
export class CxPortalRateLimitGuard implements CanActivate {
  constructor(private readonly limiter: CxPortalRateLimitService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { cxUser?: CxPortalRequestUser }>();
    this.limiter.poke(req, req.cxUser);
    return true;
  }
}
