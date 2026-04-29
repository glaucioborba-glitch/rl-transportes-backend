import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlataformaTenantStore } from '../stores/plataforma-tenant.store';
import type { PlataformaTenantConfig } from '../plataforma.types';

export class CriarTenantDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  nome!: string;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  clienteIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  config?: Partial<PlataformaTenantConfig>;
}

@ApiTags('plataforma-multi-tenant')
@ApiBearerAuth('access-token')
@Controller('tenant')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class PlataformaTenantController {
  constructor(private readonly tenants: PlataformaTenantStore) {}

  @Post()
  @Roles(Role.ADMIN)
  @Permissions('plataforma:tenant:write')
  @ApiOperation({ summary: 'Criar terminal / tenant (memória — Fase 18)' })
  criar(@Body() dto: CriarTenantDto) {
    const t = this.tenants.criar(dto.nome, dto.clienteIds ?? [], dto.config);
    return { success: true, data: t };
  }

  @Get()
  @Roles(Role.ADMIN)
  @Permissions('plataforma:tenant:read')
  @ApiOperation({ summary: 'Listar tenants' })
  listar() {
    return { success: true, data: this.tenants.listar() };
  }

  @Get(':id/config')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('plataforma:tenant:read')
  @ApiOperation({ summary: 'Configuração isolada do terminal (SLA, horários, regras)' })
  config(@Param('id') id: string) {
    const t = this.tenants.obter(id);
    if (!t) return { success: false, error: { code: 'NOT_FOUND', message: 'Tenant não encontrado.' } };
    return { success: true, data: { id: t.id, nome: t.nome, clienteIds: t.clienteIds, config: t.config } };
  }
}
