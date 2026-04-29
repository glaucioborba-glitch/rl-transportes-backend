import { BadRequestException, Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PlataformaApiClientStore } from '../stores/plataforma-api-client.store';

export class CriarApiClientePlataformaDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  apiKey!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  secret!: string;

  @ApiProperty()
  @IsString()
  label!: string;

  @ApiProperty()
  @IsString()
  tenantId!: string;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  clienteIds?: string[];

  @ApiProperty({ required: false, default: 120 })
  @IsOptional()
  @IsInt()
  @Min(10)
  requestsPerMinute?: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

@ApiTags('plataforma-admin')
@ApiBearerAuth('access-token')
@Controller('plataforma/admin')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class PlataformaInternalAdminController {
  constructor(private readonly clients: PlataformaApiClientStore) {}

  @Get('api-clients')
  @Roles(Role.ADMIN)
  @Permissions('plataforma:api:write')
  @ApiOperation({ summary: 'Listar API Keys corporativas (sem exibir secret)' })
  listarKeys() {
    const list = this.clients.listar().map(({ secret: _s, ...rest }) => rest);
    return { success: true, data: list };
  }

  @Post('api-clients')
  @Roles(Role.ADMIN)
  @Permissions('plataforma:api:write')
  @ApiOperation({ summary: 'Criar novo par API Key + secret para parceiro externo' })
  criar(@Body() dto: CriarApiClientePlataformaDto) {
    try {
      const c = this.clients.criarClienteApi({
        apiKey: dto.apiKey,
        secret: dto.secret,
        label: dto.label,
        tenantId: dto.tenantId,
        clienteIds: dto.clienteIds ?? [],
        requestsPerMinute: dto.requestsPerMinute ?? 120,
        enabled: dto.enabled !== false,
        servicosHabilitados: [
          'tracking_operacional',
          'tracking_financeiro',
          'sla_service',
          'ciclo_operacional',
          'patio_tempo_real',
          'produtividade_stats',
          'eventos_fiscal_financeiro',
          'faturamento_pagamentos',
        ],
      });
      const { secret: _omit, ...safe } = c;
      return { success: true, data: safe };
    } catch (e) {
      throw new BadRequestException(String((e as Error).message));
    }
  }
}
