import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CockpitAccessGuard } from '../guards/cockpit-access.guard';
import { CockpitTenantService } from '../services/cockpit-tenant.service';

@ApiTags('cockpit-tenant')
@ApiBearerAuth('access-token')
@Controller('cockpit/tenant')
@UseGuards(AuthGuard('jwt'), CockpitAccessGuard)
export class CockpitTenantController {
  constructor(private readonly tenant: CockpitTenantService) {}

  @Get('list')
  @ApiOperation({ summary: 'Lista de terminais (multi-tenant Fase 18)' })
  listar() {
    return this.tenant.listar();
  }

  @Get(':id/dashboard')
  @ApiOperation({ summary: 'Dashboard consolidado por terminal' })
  dashboard(@Param('id') tenantId: string) {
    return this.tenant.dashboard(tenantId);
  }
}
