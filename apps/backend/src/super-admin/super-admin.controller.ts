import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, TenantStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SuperAdminService } from './super-admin.service';

class EmpresaIdentidadeDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  razaoSocial?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nomeFantasia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(9)
  cep?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  logradouro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  numero?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bairro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  cidade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  uf?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefone?: string;
}

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

  @IsOptional()
  @IsString()
  @MaxLength(18)
  cnpj?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => EmpresaIdentidadeDto)
  empresa?: EmpresaIdentidadeDto;
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

  @IsOptional()
  @IsString()
  @MaxLength(18)
  cnpj?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => EmpresaIdentidadeDto)
  empresa?: EmpresaIdentidadeDto;
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
  constructor(private readonly saas: SuperAdminService) {}

  @Get('tenants')
  @ApiOperation({ summary: 'Listar terminais (tenants) SaaS' })
  listTenants() {
    return this.saas.listTenants();
  }

  @Post('tenants')
  @ApiOperation({ summary: 'Cadastrar novo terminal' })
  createTenant(@Body() dto: CriarTenantDto) {
    return this.saas.createTenant(dto);
  }

  @Patch('tenants/:id')
  @ApiOperation({ summary: 'Atualizar nome, plano, CNPJ ou status do terminal' })
  updateTenant(@Param('id') id: string, @Body() dto: AtualizarTenantDto) {
    return this.saas.updateTenant(id, dto);
  }

  @Delete('tenants/:id')
  @ApiOperation({ summary: 'Excluir terminal vazio (nunca o default; com dados, bloqueie)' })
  deleteTenant(@Param('id') id: string) {
    return this.saas.deleteTenant(id);
  }

  @Get('feature-flags')
  @ApiOperation({ summary: 'Feature flags globais do SaaS' })
  listFlags() {
    return this.saas.listFlags();
  }

  @Post('feature-flags/ensure-known')
  @ApiOperation({ summary: 'Garante as flags conhecidas do produto (inativas por padrão)' })
  ensureKnownFlags() {
    return this.saas.ensureKnownFlags();
  }

  @Patch('feature-flags/:chave')
  @ApiOperation({ summary: 'Atualizar feature flag' })
  patchFlag(@Param('chave') chave: string, @Body() dto: PatchFeatureFlagDto) {
    return this.saas.patchFlag(chave, dto);
  }
}
