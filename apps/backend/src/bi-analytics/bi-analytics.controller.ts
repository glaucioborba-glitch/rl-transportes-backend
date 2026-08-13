import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BiAnalyticsRefreshService, BiAnalyticsService } from './bi-analytics.service';
import type { TorreControleResponse, VisaoOperacionalResponse } from './bi-analytics.types';

@ApiTags('bi-analytics')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('bi-analytics')
export class BiAnalyticsController {
  constructor(
    private readonly bi: BiAnalyticsService,
    private readonly refresh: BiAnalyticsRefreshService,
  ) {}

  @Get('torre-de-controle')
  @Roles(Role.ADMIN)
  @Permissions('bi:torre:read')
  @ApiOperation({ summary: 'Torre de Controle — visão 360º (ADMIN, dados financeiros + operacionais)' })
  getTorreControle(): Promise<TorreControleResponse> {
    return this.bi.getTorreControle();
  }

  @Get('visao-operacional')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('bi:operacional:read')
  @ApiOperation({
    summary: 'Visão Operacional — projeções e gargalos (sem valores monetários)',
  })
  getVisaoOperacional(): Promise<VisaoOperacionalResponse> {
    return this.bi.getVisaoOperacional();
  }

  @Post('refresh')
  @Roles(Role.ADMIN)
  @Permissions('bi:torre:read')
  @ApiOperation({ summary: 'Refresh manual das materialized views (ADMIN)' })
  refreshViews() {
    return this.refresh.refreshAll();
  }
}
