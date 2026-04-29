import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { DashboardAutomacaoService } from './dashboard-automacao.service';

@ApiTags('automacao-dashboard')
@ApiBearerAuth('access-token')
@Controller('automacao/dashboard')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA, Role.OPERADOR_GATE, Role.OPERADOR_PATIO)
export class DashboardAutomacaoController {
  constructor(private readonly dash: DashboardAutomacaoService) {}

  @Get()
  @ApiOperation({ summary: 'Painel executivo de automação (proxies em memória)' })
  @Permissions('automacao:read')
  resumo() {
    return this.dash.resumo();
  }
}
