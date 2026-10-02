import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { DashboardService } from './dashboard.service';
import { DashboardKpisQueryDto } from './dto/dashboard-kpis-query.dto';
import { DashboardKpisDto } from './dto/dashboard-kpis.dto';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardOperacionalResponseDto } from './dto/dashboard-response.dto';

@ApiTags('dashboard')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('kpis')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300_000)
  @Roles(
    Role.ADMIN,
    Role.GERENTE,
    Role.OPERADOR_PORTARIA,
    Role.OPERADOR_GATE,
    Role.OPERADOR_PATIO,
  )
  @Permissions('dashboard:operacional')
  @ApiOperation({
    summary: 'KPIs cockpit BI — TAT, TEU, ocupação, frota, séries gráficas',
    description: 'Cache HTTP 5 min. Filtro periodo=hoje|semana|mes.',
  })
  @ApiOkResponse({ type: DashboardKpisDto })
  getKpis(@Query() query: DashboardKpisQueryDto): Promise<DashboardKpisDto> {
    return this.dashboardService.calculateKpis(query.periodo ?? 'hoje');
  }

  @Get()
  @Roles(
    Role.ADMIN,
    Role.GERENTE,
    Role.OPERADOR_PORTARIA,
    Role.OPERADOR_GATE,
    Role.OPERADOR_PATIO,
  )
  @Permissions('dashboard:operacional')
  @ApiOperation({
    summary: 'Painel operacional (snapshot, SLA, filas, conflitos, telemetria)',
    description:
      'Agregações somente leitura. A secção `clientes` (financeiro/portal) é omitida para perfis operacionais; apenas ADMIN e GERENTE recebem o bloco completo.',
  })
  @ApiOkResponse({ type: DashboardOperacionalResponseDto })
  getOperacional(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<DashboardOperacionalResponseDto> {
    return this.dashboardService.getDashboard(query, user);
  }
}
