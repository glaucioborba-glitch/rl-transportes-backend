import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { mergeReguaCobranca } from '../common/finance/regua-cobranca.util';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateReguaCobrancaDto } from './dto/update-regua-cobranca.dto';
import { TenantConfigService } from './tenant-config.service';
import { DEFAULT_TENANT_ID } from './tenant.constants';

@ApiTags('tenant-config')
@Controller('tenant-config')
export class TenantConfigController {
  constructor(private readonly config: TenantConfigService) {}

  @Get('turnos/:tenantId')
  @ApiOperation({ summary: 'Turnos de agendamento configurados para o terminal' })
  turnos(@Param('tenantId') tenantId: string) {
    return this.config.getTurnosAgendamento(tenantId);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Configuração do tenant do usuário autenticado' })
  async me(@Req() req: Request & { tenantId?: string }) {
    return this.config.getParametros(req.tenantId ?? DEFAULT_TENANT_ID);
  }

  @Get('regua-cobranca')
  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @ApiBearerAuth('access-token')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('dashboard:financeiro')
  @ApiOperation({ summary: 'Régua de cobrança do tenant autenticado' })
  async getReguaCobranca(@Req() req: Request & { tenantId?: string }) {
    const { tenantId, parametros } = await this.config.getParametros(req.tenantId ?? DEFAULT_TENANT_ID);
    return { tenantId, reguaCobranca: mergeReguaCobranca(parametros.reguaCobranca) };
  }

  @Patch('regua-cobranca')
  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @ApiBearerAuth('access-token')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('dashboard:financeiro')
  @ApiOperation({ summary: 'Atualiza régua de cobrança do tenant' })
  async patchReguaCobranca(
    @Req() req: Request & { tenantId?: string },
    @Body() dto: UpdateReguaCobrancaDto,
  ) {
    const tenantId = req.tenantId ?? DEFAULT_TENANT_ID;
    const current = await this.config.getParametros(tenantId);
    const merged = mergeReguaCobranca({
      ...current.parametros.reguaCobranca,
      ...dto,
      etapas: { ...current.parametros.reguaCobranca?.etapas, ...dto.etapas },
    });
    const updated = await this.config.updateParametros(tenantId, { reguaCobranca: merged });
    return {
      tenantId: updated.tenantId,
      reguaCobranca: mergeReguaCobranca(updated.parametros.reguaCobranca),
    };
  }
}
