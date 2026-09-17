import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { mergeReguaCobranca } from '../common/finance/regua-cobranca.util';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateParametrosGeraisDto } from './dto/update-parametros-gerais.dto';
import { FeriadoMunicipalDto } from './dto/feriado-municipal.dto';
import { UpdateReguaCobrancaDto } from './dto/update-regua-cobranca.dto';
import { sanitizeTenantParametrosForClient } from './integration-credentials.util';
import { TenantConfigService } from './tenant-config.service';
import { DEFAULT_TENANT_ID } from './tenant.constants';

const PARAMETROS_ROLES: Role[] = [Role.ADMIN, Role.GERENTE];

@ApiTags('tenant-config')
@Controller('tenant-config')
export class TenantConfigController {
  constructor(private readonly config: TenantConfigService) {}

  @Get('turnos')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Turnos de agendamento do tenant autenticado',
    description: 'Tenant vem do JWT. SUPER_ADMIN pode passar ?tenantId=. Portal: GET /cliente/portal/turnos.',
  })
  turnos(@Req() req: Request & { tenantId?: string; user?: { role?: Role; tenantId?: string } }, @Query('tenantId') tenantQ?: string) {
    const role = req.user?.role;
    const tenantId =
      role === Role.SUPER_ADMIN && tenantQ?.trim()
        ? tenantQ.trim()
        : (req.tenantId ?? req.user?.tenantId ?? DEFAULT_TENANT_ID);
    return this.config.getTurnosAgendamento(tenantId);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Configuração do tenant do usuário autenticado' })
  async me(@Req() req: Request & { tenantId?: string }) {
    const raw = await this.config.getParametros(req.tenantId ?? DEFAULT_TENANT_ID);
    return {
      ...raw,
      parametros: sanitizeTenantParametrosForClient(raw.parametros as Record<string, unknown>),
    };
  }

  @Get('parametros-gerais')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(...PARAMETROS_ROLES)
  @ApiOperation({ summary: 'Parâmetros gerais do terminal (operacional, financeiro, fiscal, etc.)' })
  async getParametrosGerais(@Req() req: Request & { tenantId?: string; user?: { role?: Role } }) {
    const data = await this.config.getParametrosGerais(req.tenantId ?? DEFAULT_TENANT_ID);
    if (req.user?.role === Role.SUPER_ADMIN) return data;
    const { integracoes: _hidden, ...rest } = data;
    return rest;
  }

  @Get('maps-config')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Chave Maps JS do terminal (restrita por referrer no Google Cloud)' })
  async mapsConfig(@Req() req: Request & { tenantId?: string }) {
    return this.config.getMapsConfig(req.tenantId ?? DEFAULT_TENANT_ID);
  }

  @Patch('parametros-gerais')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(...PARAMETROS_ROLES)
  @ApiOperation({ summary: 'Atualiza parâmetros gerais (patch parcial)' })
  async updateParametrosGerais(
    @Req() req: Request & { tenantId?: string },
    @Body() dto: UpdateParametrosGeraisDto,
  ) {
    if (dto.integracoes) {
      throw new ForbiddenException('Integrações do sistema só o Super Admin configura.');
    }
    return this.config.updateParametrosGerais(req.tenantId ?? DEFAULT_TENANT_ID, dto);
  }

  @Get('parametros-gerais/capacidade-calc')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(...PARAMETROS_ROLES)
  @ApiOperation({ summary: 'Calcula capacidade total a partir de posições de pátio ativas' })
  async calcCapacidade(@Req() req: Request & { tenantId?: string }) {
    return this.config.calcularCapacidadeAutomatica(req.tenantId ?? DEFAULT_TENANT_ID);
  }

  @Get('parametros-gerais/feriados/:ano')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(...PARAMETROS_ROLES)
  @ApiOperation({ summary: 'Feriados nacionais (BrasilAPI) + municipais do tenant' })
  async getFeriados(@Req() req: Request & { tenantId?: string }, @Param('ano') ano: string) {
    return this.config.getFeriados(req.tenantId ?? DEFAULT_TENANT_ID, parseInt(ano, 10));
  }

  @Post('parametros-gerais/feriados')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(...PARAMETROS_ROLES)
  @ApiOperation({ summary: 'Adiciona feriado municipal' })
  async addFeriado(@Req() req: Request & { tenantId?: string }, @Body() dto: FeriadoMunicipalDto) {
    return this.config.addFeriadoMunicipal(req.tenantId ?? DEFAULT_TENANT_ID, dto.data, dto.nome);
  }

  @Delete('parametros-gerais/feriados/:data')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(...PARAMETROS_ROLES)
  @ApiOperation({ summary: 'Remove feriado municipal' })
  async removeFeriado(@Req() req: Request & { tenantId?: string }, @Param('data') data: string) {
    return this.config.removeFeriadoMunicipal(req.tenantId ?? DEFAULT_TENANT_ID, data);
  }

  @Get('test/ipm')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(...PARAMETROS_ROLES)
  async testIpm() {
    const r = await this.config.testIpmConnection();
    return { connected: r.connected, message: r.message, latency: r.latencyMs };
  }

  @Get('test/whatsapp')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPER_ADMIN)
  async testWhatsapp() {
    const r = await this.config.testWhatsappConnection();
    return { connected: r.connected, message: r.message, latency: r.latencyMs };
  }

  @Get('test/google-vision')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPER_ADMIN)
  async testGoogleVision() {
    const r = await this.config.testGoogleVisionConnection();
    return { connected: r.connected, message: r.message, latency: r.latencyMs };
  }

  @Get('test/banking')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPER_ADMIN)
  async testBanking() {
    const r = await this.config.testBankingConnection();
    return { connected: r.connected, message: r.message, latency: r.latencyMs };
  }

  @Get('test/s3')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(Role.SUPER_ADMIN)
  async testS3() {
    const r = await this.config.testS3Connection();
    return { connected: r.connected, message: r.message, latency: r.latencyMs };
  }

  @Post('test/whatsapp-templates')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(...PARAMETROS_ROLES)
  async revalidateWhatsappTemplates(@Req() req: Request & { tenantId?: string }) {
    const templates = await this.config.revalidateWhatsappTemplates();
    return { templates };
  }

  @Post('test/slack-webhook')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(...PARAMETROS_ROLES)
  async testSlackWebhook(@Body() body: { url: string }) {
    const r = await this.config.testSlackWebhook(body.url);
    return { connected: r.connected, message: r.message, latency: r.latencyMs };
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
