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
import { DashboardFinanceiroService } from './dashboard-financeiro.service';
import { DashboardFinanceiroQueryDto } from './dto/dashboard-financeiro-query.dto';
import { DashboardFinanceiroExecutivoResponseDto } from './dto/dashboard-financeiro-response.dto';

@ApiTags('dashboard-financeiro')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('dashboard-financeiro')
export class DashboardFinanceiroController {
  constructor(private readonly dashboardFinanceiroService: DashboardFinanceiroService) {}

  @Get()
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('dashboard:financeiro_executivo')
  @ApiOperation({
    summary: 'Dashboard financeiro executivo',
    description:
      'Agregações de faturamento, boletos, séries por competência (YYYY-MM), aging e curva ABC. Somente gestão.',
  })
  @ApiOkResponse({ type: DashboardFinanceiroExecutivoResponseDto })
  getExecutivo(
    @Query() query: DashboardFinanceiroQueryDto,
    @CurrentUser() _user: AuthUser,
  ): Promise<DashboardFinanceiroExecutivoResponseDto> {
    void _user;
    return this.dashboardFinanceiroService.getExecutivo(query);
  }
}
