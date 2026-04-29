import { Body, Controller, Get, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { AcaoAuditoria } from '@prisma/client';
import type { Request } from 'express';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CxPortalStaffOnly } from './decorators/cx-portal.decorators';
import {
  CxPortalAuthGuard,
  CxPortalPublicApiForbidGuard,
} from './guards/cx-portal-auth.guard';
import { CxPortalRateLimitGuard } from './guards/cx-portal-rate-limit.guard';
import { CxPortalStaffOnlyGuard } from './guards/cx-portal-segment.guard';
import { PortalCxInterceptor } from './interceptors/portal-cx.interceptor';
import { PortalBrandingStore, type PortalBrandingConfig } from './stores/portal-branding.store';
import type { CxPortalRequestUser } from './types/cx-portal.types';

class CoresDto {
  @ApiProperty()
  @IsString()
  primaria: string;

  @ApiProperty()
  @IsString()
  secundaria: string;
}

class BrandingUpsertDto {
  @ApiProperty()
  @IsString()
  tenantId: string;

  @ApiProperty({ required: false })
  @ValidateNested()
  @Type(() => CoresDto)
  @IsOptional()
  cores?: CoresDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiProperty({ enum: ['light', 'dark'] })
  @IsOptional()
  @IsIn(['light', 'dark'])
  tema?: 'light' | 'dark';

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  menuItens?: string[];

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  slasExibidos?: string[];

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  kpisExibidos?: string[];
}

@ApiTags('cx-portal-branding')
@ApiBearerAuth('access-token')
@Controller('portal/branding')
@UseGuards(CxPortalPublicApiForbidGuard, CxPortalAuthGuard, CxPortalRateLimitGuard)
@UseInterceptors(PortalCxInterceptor)
export class PortalBrandingController {
  constructor(
    private readonly branding: PortalBrandingStore,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Obter white-label do tenant',
    description: 'JWT portal (cliente/fornecedor) ou staff. Query `tenantId` opcional.',
  })
  obter(@Req() req: Request & { cxUser?: CxPortalRequestUser }, @Query('tenantId') tenantQ?: string) {
    const u = req.cxUser;
    const tenantId = tenantQ?.trim() || u?.tenantId || 'default';
    return this.branding.obter(tenantId);
  }

  @Post()
  @CxPortalStaffOnly()
  @UseGuards(CxPortalStaffOnlyGuard)
  @ApiOperation({ summary: 'Atualizar branding (ADMIN/GERENTE JWT corporativo)' })
  async salvar(@Req() req: Request & { cxUser?: CxPortalRequestUser }, @Body() body: BrandingUpsertDto) {
    const u = req.cxUser!;
    const patch: Partial<PortalBrandingConfig> = {};
    if (body.cores) patch.cores = body.cores;
    if (body.logoUrl != null) patch.logoUrl = body.logoUrl;
    if (body.tema) patch.tema = body.tema;
    if (body.menuItens) patch.menuItens = body.menuItens;
    if (body.slasExibidos) patch.slasExibidos = body.slasExibidos;
    if (body.kpisExibidos) patch.kpisExibidos = body.kpisExibidos;
    const out = this.branding.salvar(body.tenantId, patch);
    await this.auditoria.registrar({
      tabela: 'cx_portal_branding',
      registroId: body.tenantId,
      acao: AcaoAuditoria.UPDATE,
      usuario: u.sub,
      dadosDepois: { portal: true, tipo: 'PORTAL', out },
    });
    return out;
  }
}
