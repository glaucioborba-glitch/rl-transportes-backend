import {
  Controller,
  Get,
  NotFoundException,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CxPortalSegment } from './decorators/cx-portal.decorators';
import { JwtPortalAuthGuard } from './guards/jwt-portal.guard';
import {
  CxPortalPublicApiForbidGuard,
} from './guards/cx-portal-auth.guard';
import { CxPortalRateLimitGuard } from './guards/cx-portal-rate-limit.guard';
import { CxPortalSegmentGuard } from './guards/cx-portal-segment.guard';
import { PortalCxInterceptor } from './interceptors/portal-cx.interceptor';
import { DashboardPortalService } from './services/dashboard-portal.service';
import type { CxPortalRequestUser } from './types/cx-portal.types';

/**
 * Controller oficial: `GET /cliente/portal/dashboard`
 * (equivalente a `@Controller('cliente/portal')` + `@Get('dashboard')`).
 */
@ApiTags('cx-portal-cliente')
@ApiBearerAuth('access-token')
@Controller('cliente/portal/dashboard')
@UseGuards(
  CxPortalPublicApiForbidGuard,
  JwtPortalAuthGuard,
  CxPortalRateLimitGuard,
  CxPortalSegmentGuard,
)
@CxPortalSegment('cliente')
@UseInterceptors(PortalCxInterceptor)
export class DashboardPortalController {
  constructor(private readonly dashboard: DashboardPortalService) {}

  private cx(req: Request & { cxUser?: CxPortalRequestUser }) {
    const u = req.cxUser;
    if (!u) throw new NotFoundException();
    return u;
  }

  @Get()
  @ApiOperation({
    summary: 'Dashboard consolidado do portal cliente',
    description:
      'JWT portal `CLIENTE` ou staff com `?clienteId=`. Paginação opcional: `recentPage`, `recentLimit`.',
  })
  async getDashboard(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Query('clienteId') clienteId?: string,
    @Query('recentPage') recentPage?: string,
    @Query('recentLimit') recentLimit?: string,
  ) {
    const u = this.cx(req);
    const rp = parseInt(recentPage ?? '1', 10);
    const rl = parseInt(recentLimit ?? '8', 10);
    return this.dashboard.buildConsolidated(u, clienteId, {
      recentPage: Number.isFinite(rp) && rp > 0 ? rp : 1,
      recentLimit: Number.isFinite(rl) && rl > 0 ? Math.min(100, rl) : 8,
    });
  }
}
