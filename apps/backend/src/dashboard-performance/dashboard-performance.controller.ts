import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { DashboardPerformanceService } from './dashboard-performance.service';
import { DashboardPerformanceQueryDto } from './dto/dashboard-performance-query.dto';
import { DashboardPerformanceResponseDto } from './dto/dashboard-performance-response.dto';

@ApiTags('dashboard-performance')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('dashboard-performance')
export class DashboardPerformanceController {
  constructor(private readonly dashboardPerformanceService: DashboardPerformanceService) {}

  @Get()
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA, Role.OPERADOR_GATE, Role.OPERADOR_PATIO)
  @Permissions('dashboard:performance')
  @ApiOperation({
    summary: 'Dashboard de performance operacional (custo × margem × produtividade)',
    description:
      'Agregações somente leitura alinhadas ao fluxo Portaria → Gate → Pátio → Saída. ADMIN e GERENTE recebem indicadores financeiros e séries completas; perfis operacionais recebem throughput e própria produtividade (24h). CLIENTE não autorizado.',
  })
  @ApiOkResponse({ type: DashboardPerformanceResponseDto })
  getPerformance(
    @Query() query: DashboardPerformanceQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<DashboardPerformanceResponseDto> {
    return this.dashboardPerformanceService.getPerformance(query, user);
  }
}
