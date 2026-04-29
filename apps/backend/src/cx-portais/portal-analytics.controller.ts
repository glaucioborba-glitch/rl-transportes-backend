import { Controller, Get, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CxPortalStaffOnly } from './decorators/cx-portal.decorators';
import {
  CxPortalAuthGuard,
  CxPortalPublicApiForbidGuard,
} from './guards/cx-portal-auth.guard';
import { CxPortalRateLimitGuard } from './guards/cx-portal-rate-limit.guard';
import { CxPortalStaffOnlyGuard } from './guards/cx-portal-segment.guard';
import { PortalCxInterceptor } from './interceptors/portal-cx.interceptor';
import { PortalAnalyticsStore } from './stores/portal-analytics.store';

@ApiTags('cx-portal-analytics')
@ApiBearerAuth('access-token')
@CxPortalStaffOnly()
@Controller('portal/analytics')
@UseGuards(CxPortalPublicApiForbidGuard, CxPortalAuthGuard, CxPortalRateLimitGuard, CxPortalStaffOnlyGuard)
@UseInterceptors(PortalCxInterceptor)
export class PortalAnalyticsController {
  constructor(private readonly analytics: PortalAnalyticsStore) {}

  @Get()
  @ApiOperation({
    summary: 'Analytics de uso dos portais',
    description: 'Somente **ADMIN/GERENTE** com JWT corporativo.',
  })
  resumo(@Req() _req: Request) {
    void _req;
    return this.analytics.resumo();
  }
}
