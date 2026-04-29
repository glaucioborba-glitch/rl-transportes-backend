import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcaoAuditoria, Role } from '@prisma/client';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlataformaApiClientStore } from '../stores/plataforma-api-client.store';
import type { PlataformaServicoId } from '../plataforma.types';
import type { Request } from 'express';

export class MarketplaceAssinaturaDto {
  @ApiProperty()
  @IsUUID()
  apiClientId!: string;

  @ApiProperty({ type: [String], example: ['tracking_operacional', 'sla_service'] })
  @IsArray()
  servicoIds!: PlataformaServicoId[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  habilitado?: boolean;
}

@ApiTags('plataforma-marketplace-admin')
@ApiBearerAuth('access-token')
@Controller('marketplace')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class PlataformaMarketplaceAdminController {
  constructor(
    private readonly clients: PlataformaApiClientStore,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Post('assinaturas')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN)
  @Permissions('plataforma:marketplace:write')
  @ApiOperation({
    summary: 'Registrar assinatura marketplace (habilita/desabilita APIs por cliente corporativo)',
  })
  async assinar(@Body() dto: MarketplaceAssinaturaDto, @Req() req: Request & { user: { sub: string } }) {
    const c = this.clients.obterPorId(dto.apiClientId);
    if (!c) {
      return { success: false, error: { code: 'CLIENT_NOT_FOUND', message: 'API client inexistente.' } };
    }
    const servicos = dto.habilitado === false ? [] : dto.servicoIds;
    this.clients.atualizarServicos(dto.apiClientId, servicos);
    await this.auditoria.registrar({
      tabela: 'plataforma_marketplace_assinatura',
      registroId: dto.apiClientId,
      acao: AcaoAuditoria.UPDATE,
      usuario: req.user.sub,
      dadosDepois: { servicoIds: servicos, habilitado: dto.habilitado !== false },
    });
    return { success: true, data: { apiClientId: dto.apiClientId, servicosHabilitados: servicos } };
  }
}
