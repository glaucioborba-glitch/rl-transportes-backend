import { Body, Controller, Delete, Get, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, TenantStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import type { Request, Response } from 'express';
import { IsEnum, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SuperAdminService } from './super-admin.service';
import { IDIOMAS_PADRAO, MOEDAS_CORRENTES } from '../tenant/tenant-locale.util';
import { TenantConfigService } from '../tenant/tenant-config.service';
import { UpdateIntegracoesDto } from '../tenant/dto/update-parametros-gerais.dto';

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

  @IsOptional()
  @IsIn([...MOEDAS_CORRENTES])
  moedaCorrente?: (typeof MOEDAS_CORRENTES)[number];

  @IsOptional()
  @IsIn([...IDIOMAS_PADRAO])
  idiomaPadrao?: (typeof IDIOMAS_PADRAO)[number];
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

  @IsOptional()
  @IsIn([...MOEDAS_CORRENTES])
  moedaCorrente?: (typeof MOEDAS_CORRENTES)[number];

  @IsOptional()
  @IsIn([...IDIOMAS_PADRAO])
  idiomaPadrao?: (typeof IDIOMAS_PADRAO)[number];
}

class PatchFeatureFlagDto {
  @IsOptional()
  ativo?: boolean;

  @IsOptional()
  regras?: Record<string, unknown>;
}

class EntrarIntranetDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,63}$/)
  tenantId!: string;
}

@ApiTags('super-admin')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('super-admin')
export class SuperAdminController {
  constructor(
    private readonly saas: SuperAdminService,
    private readonly tenantConfig: TenantConfigService,
  ) {}

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

  @Get('tenants/:id/integracoes')
  @ApiOperation({ summary: 'Status das integrações do terminal (sem secrets)' })
  getIntegracoes(@Param('id') id: string) {
    return this.tenantConfig.getIntegracoes(id);
  }

  @Patch('tenants/:id/integracoes')
  @ApiOperation({ summary: 'Salva credenciais de integração do terminal' })
  patchIntegracoes(@Param('id') id: string, @Body() dto: UpdateIntegracoesDto) {
    return this.tenantConfig.updateIntegracoes(id, dto);
  }

  @Get('tenants/:id/integracoes/test/:probe')
  @ApiOperation({ summary: 'Testa uma integração do terminal' })
  async testIntegracao(
    @Param('id') id: string,
    @Param('probe')
    probe:
      | 'whatsapp'
      | 'google-vision'
      | 'google-maps'
      | 'google-routes'
      | 'banking'
      | 'boleto'
      | 'pix'
      | 's3'
      | 'ipm'
      | 'nfse-nacional',
  ) {
    const r = await this.tenantConfig.testIntegracao(id, probe);
    return { connected: r.connected, message: r.message, latency: r.latencyMs };
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

  @Post('entrar-intranet')
  @ApiOperation({ summary: 'Abrir a intranet operacional de um terminal (mesmo login do dono)' })
  entrarIntranet(@Body() dto: EntrarIntranetDto, @Res({ passthrough: true }) res: Response) {
    return this.saas.entrarIntranet(dto.tenantId, res);
  }

  @Post('sair-intranet')
  @ApiOperation({ summary: 'Sair da intranet do terminal e voltar ao cockpit SaaS' })
  sairIntranet(@Res({ passthrough: true }) res: Response) {
    return this.saas.sairIntranet(res);
  }

  @Get('intranet-sessao')
  @ApiOperation({ summary: 'Terminal em que o dono está operando a intranet, se houver' })
  intranetSessao(@Req() req: Request) {
    return this.saas.intranetSessao(req);
  }
}
