import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, TenantStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { FeatureFlagService } from '../feature-flags/feature-flag.service';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_TENANT_PARAMETROS } from '../tenant/tenant-config.types';

class CriarTenantDto {
  @IsString()
  @MinLength(2)
  slug!: string;

  @IsString()
  @MinLength(2)
  nome!: string;

  @IsOptional()
  @IsString()
  plano?: string;
}

class AtualizarTenantDto {
  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

  @IsOptional()
  @IsString()
  plano?: string;

  @IsOptional()
  @IsString()
  nome?: string;
}

class PatchFeatureFlagDto {
  @IsOptional()
  ativo?: boolean;

  @IsOptional()
  regras?: Record<string, unknown>;
}

@ApiTags('super-admin')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('super-admin')
export class SuperAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagService,
  ) {}

  @Get('tenants')
  @ApiOperation({ summary: 'Listar terminais (tenants) SaaS' })
  listTenants() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: { config: { select: { tenantKey: true, nome: true } } },
    });
  }

  @Post('tenants')
  @ApiOperation({ summary: 'Cadastrar novo terminal' })
  async createTenant(@Body() dto: CriarTenantDto) {
    const id = dto.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!id) throw new BadRequestException('Slug inválido');
    const existing = await this.prisma.tenant.findUnique({ where: { id } });
    if (existing) throw new BadRequestException('Tenant já existe');

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          id,
          slug: id,
          nome: dto.nome.trim(),
          plano: dto.plano?.trim() || 'STANDARD',
        },
      });
      await tx.tenantConfig.create({
        data: {
          tenantId: id,
          tenantKey: id,
          nome: dto.nome.trim(),
          parametros: DEFAULT_TENANT_PARAMETROS as object,
          slasHorasProxy: { gate: 4, patio: 72, saida: 24 },
          horarioFuncionamento: '06:00–22:00',
          regrasOperacao: 'Configuração inicial SaaS',
        },
      });
      return tenant;
    });
  }

  @Patch('tenants/:id')
  @ApiOperation({ summary: 'Atualizar status/plano do terminal (bloquear por inadimplência)' })
  updateTenant(@Param('id') id: string, @Body() dto: AtualizarTenantDto) {
    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.plano !== undefined ? { plano: dto.plano } : {}),
        ...(dto.nome !== undefined ? { nome: dto.nome.trim() } : {}),
      },
    });
  }

  @Get('feature-flags')
  @ApiOperation({ summary: 'Feature flags globais do SaaS' })
  listFlags() {
    return this.prisma.featureFlag.findMany({ orderBy: { chave: 'asc' } });
  }

  @Patch('feature-flags/:chave')
  @ApiOperation({ summary: 'Atualizar feature flag (ex: BI Premium por tenant)' })
  async patchFlag(@Param('chave') chave: string, @Body() dto: PatchFeatureFlagDto) {
    return this.prisma.featureFlag.update({
      where: { chave },
      data: {
        ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
        ...(dto.regras !== undefined ? { regras: dto.regras as object } : {}),
      },
    });
  }
}
