import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CategoriaAuditLog } from '@prisma/client';
import { appendAuditTrailEntry } from '../audit-trail/audit-trail-capture.util';
import { AuditContextService } from '../audit-trail/audit-context.service';
import { ConfigCacheService } from '../common/cache/config-cache.service';
import { mergeReguaCobranca } from '../common/finance/regua-cobranca.util';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateIntegracoesDto, UpdateParametrosGeraisDto } from './dto/update-parametros-gerais.dto';
import { DEFAULT_TENANT_ID } from './tenant.constants';
import {
  mergeIntegracoesCredenciais,
  parseGoogleServiceAccountJson,
} from './integration-credentials.util';
import { IntegrationCredentialsService } from './integration-credentials.service';
import { TenantConfigProbesService } from './tenant-config-probes.service';
import { TenantContextService } from './tenant-context.service';
import {
  DEFAULT_SEGURANCA,
  DEFAULT_TENANT_PARAMETROS,
  mergeTenantParametros,
  resolveCertificadoStatus,
  resolveFinanceiro,
  resolveFiscal,
  resolveNotificacoes,
  resolveOperacional,
  resolveSeguranca,
  syncLegacyOperacaoFields,
  turnosOperacionaisToLegacy,
  type TenantFeriadoMunicipal,
  type TenantParametros,
  type TenantParametrosSeguranca,
} from './tenant-config.types';

export type FeriadoNacionalApi = { date: string; name: string; type: string };

export type FeriadosResponse = {
  nacionais: FeriadoNacionalApi[];
  municipais: TenantFeriadoMunicipal[];
};
export type ParametrosGeraisResponse = {
  tenantId: string;
  operacional: ReturnType<typeof resolveOperacional>;
  financeiro: ReturnType<typeof resolveFinanceiro>;
  fiscal: ReturnType<typeof resolveFiscal>;
  seguranca: TenantParametrosSeguranca;
  integracoes: ReturnType<TenantConfigProbesService['buildIntegracoesStatus']>;
  notificacoes: ReturnType<typeof resolveNotificacoes>;
  reguaCobranca: ReturnType<typeof mergeReguaCobranca>;
  turnos: NonNullable<TenantParametros['operacao']>['turnos'];
};

@Injectable()
export class TenantConfigService {
  private readonly cachePrefix = 'tenant:parametros';
  private readonly segurancaCache = new Map<string, TenantParametrosSeguranca>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditContext: AuditContextService,
    private readonly cache: ConfigCacheService,
    private readonly config: ConfigService,
    private readonly probes: TenantConfigProbesService,
    private readonly integrationCreds: IntegrationCredentialsService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private cacheKey(tenantId: string) {
    return this.cache.key(this.cachePrefix, tenantId);
  }

  async getParametros(tenantId: string = DEFAULT_TENANT_ID) {
    const row = await this.prisma.tenantConfig.findFirst({
      where: { OR: [{ tenantId }, { tenantKey: tenantId }] },
    });
    if (!row) {
      return { tenantId, nome: 'Default', parametros: DEFAULT_TENANT_PARAMETROS };
    }
    return {
      tenantId: row.tenantId,
      nome: row.nome,
      parametros: mergeTenantParametros(row.parametros),
    };
  }

  async getParametrosSeguranca(tenantId: string = DEFAULT_TENANT_ID): Promise<TenantParametrosSeguranca> {
    const { parametros } = await this.getParametros(tenantId);
    const resolved = resolveSeguranca(parametros);
    this.segurancaCache.set(tenantId, resolved);
    return resolved;
  }

  getParametrosSegurancaSync(tenantId: string = DEFAULT_TENANT_ID): TenantParametrosSeguranca {
    return this.segurancaCache.get(tenantId) ?? DEFAULT_SEGURANCA;
  }

  async getParametrosGerais(tenantId: string = DEFAULT_TENANT_ID): Promise<ParametrosGeraisResponse> {
    const cached = await this.cache.get<ParametrosGeraisResponse>(this.cacheKey(tenantId));
    if (cached) {
      await this.integrationCreds.load(tenantId);
      return { ...cached, integracoes: this.probes.buildIntegracoesStatus() };
    }

    const { tenantId: tid, parametros } = await this.getParametros(tenantId);
    const envMunicipio = this.config.get<string>('nfse.ipm.municipioIbge');
    this.integrationCreds.remember(tenantId, parametros.integracoesCredenciais, {
      certificadoBase64: parametros.nfse?.certificadoBase64,
      certificadoSenha: parametros.nfse?.certificadoSenha,
    });
    const integracoes = this.probes.buildIntegracoesStatus();
    const templates = await this.probes.revalidateWhatsappTemplates();
    integracoes.whatsapp.templatesAprovados = templates.filter((t) => t.status === 'APPROVED').length;

    const notificacoes = resolveNotificacoes(parametros);
    if (!notificacoes.templatesWhatsApp.length) {
      notificacoes.templatesWhatsApp = templates;
    }

    const seguranca = await this.getParametrosSeguranca(tenantId);

    const response: ParametrosGeraisResponse = {
      tenantId: tid,
      operacional: resolveOperacional(parametros),
      financeiro: resolveFinanceiro(parametros),
      fiscal: resolveFiscal(parametros, envMunicipio),
      seguranca,
      integracoes,
      notificacoes,
      reguaCobranca: mergeReguaCobranca(parametros.reguaCobranca),
      turnos: turnosOperacionaisToLegacy(resolveOperacional(parametros).turnos),
    };    await this.cache.set(this.cacheKey(tenantId), response);
    return response;
  }

  async updateParametros(tenantId: string, patch: Record<string, unknown>) {
    const current = await this.getParametros(tenantId);
    const merged = mergeTenantParametros({ ...current.parametros, ...patch });
    const row = await this.prisma.tenantConfig.findFirst({
      where: { OR: [{ tenantId }, { tenantKey: tenantId }] },
    });
    if (!row) {
      throw new NotFoundException(`Config não encontrada para tenant ${tenantId}`);
    }
    const updated = await this.prisma.tenantConfig.update({
      where: { id: row.id },
      data: { parametros: merged as object },
    });
    await this.cache.invalidate(this.cacheKey(tenantId));
    this.integrationCreds.remember(tenantId, merged.integracoesCredenciais, {
      certificadoBase64: merged.nfse?.certificadoBase64,
      certificadoSenha: merged.nfse?.certificadoSenha,
    });
    await this.getParametrosSeguranca(tenantId);
    return { tenantId: updated.tenantId, parametros: mergeTenantParametros(updated.parametros) };
  }

  async updateParametrosGerais(tenantId: string, dto: UpdateParametrosGeraisDto) {
    const current = await this.getParametros(tenantId);
    const before = {
      operacional: resolveOperacional(current.parametros),
      financeiro: resolveFinanceiro(current.parametros),
      fiscal: resolveFiscal(current.parametros, this.config.get<string>('nfse.ipm.municipioIbge')),
      seguranca: resolveSeguranca(current.parametros),
      notificacoes: resolveNotificacoes(current.parametros),
    };

    const patch: Partial<TenantParametros> = {};
    if (dto.operacional) {
      const { emailSmtpSenha, ...operacionalFields } = dto.operacional;
      patch.operacional = { ...current.parametros.operacional, ...operacionalFields };
      if (emailSmtpSenha !== undefined) {
        patch.emailSmtp = emailSmtpSenha.trim()
          ? { ...current.parametros.emailSmtp, senha: emailSmtpSenha }
          : {};
      }
    }
    if (dto.financeiro) patch.financeiro = { ...current.parametros.financeiro, ...dto.financeiro };
    if (dto.fiscal) {
      const { certificadoBase64, certificadoSenha, ...fiscalFields } = dto.fiscal;
      patch.fiscal = { ...current.parametros.fiscal, ...fiscalFields };
      if (certificadoBase64 !== undefined || certificadoSenha !== undefined) {
        patch.nfse = {
          ...current.parametros.nfse,
          ...(certificadoBase64 !== undefined ? { certificadoBase64 } : {}),
          ...(certificadoSenha !== undefined ? { certificadoSenha } : {}),
        };
        patch.fiscal = {
          ...patch.fiscal,
          certificadoStatus: certificadoBase64?.trim()
            ? resolveCertificadoStatus({ certificadoBase64 })
            : 'AUSENTE',
        };
      }
    }
    if (dto.seguranca) patch.seguranca = { ...current.parametros.seguranca, ...dto.seguranca };
    if (dto.notificacoes) patch.notificacoes = { ...current.parametros.notificacoes, ...dto.notificacoes };
    if (dto.integracoes) {
      throw new ForbiddenException('Integrações do sistema só o Super Admin configura.');
    }

    const merged = syncLegacyOperacaoFields(mergeTenantParametros({ ...current.parametros, ...patch }));

    const row = await this.prisma.tenantConfig.findFirst({
      where: { OR: [{ tenantId }, { tenantKey: tenantId }] },
    });
    if (!row) throw new NotFoundException(`Config não encontrada para tenant ${tenantId}`);

    await this.prisma.tenantConfig.update({
      where: { id: row.id },
      data: { parametros: merged as object },
    });
    await this.cache.invalidate(this.cacheKey(tenantId));
    this.integrationCreds.remember(tenantId, merged.integracoesCredenciais, {
      certificadoBase64: merged.nfse?.certificadoBase64,
      certificadoSenha: merged.nfse?.certificadoSenha,
    });
    await this.getParametrosSeguranca(tenantId);

    const actor = this.auditContext.resolveActor();
    await appendAuditTrailEntry(this.prisma, actor, {
      entidadeId: row.id,
      entidadeTipo: 'TENANT_CONFIG',
      categoria: CategoriaAuditLog.OPERACIONAL,
      acao: 'PARAMETROS_ATUALIZADOS',
      dadosAnteriores: before,
      dadosNovos: {
        operacional: resolveOperacional(merged),
        financeiro: resolveFinanceiro(merged),
        fiscal: resolveFiscal(merged, this.config.get<string>('nfse.ipm.municipioIbge')),
        seguranca: resolveSeguranca(merged),
        notificacoes: resolveNotificacoes(merged),
        integracoes: dto.integracoes
          ? this.probes.buildIntegracoesStatus()
          : undefined,
      },
    });

    return this.getParametrosGerais(tenantId);
  }

  async getIntegracoes(tenantId: string) {
    await this.ensureTenant(tenantId);
    await this.integrationCreds.load(tenantId);
    const integracoes = this.probes.buildIntegracoesStatus(tenantId);
    try {
      const templates = await this.tenantCtx.run({ tenantId, bypassIsolation: false }, () =>
        this.probes.revalidateWhatsappTemplates(),
      );
      integracoes.whatsapp.templatesAprovados = templates.filter((t) => t.status === 'APPROVED').length;
    } catch {
      /* status ainda vale sem a contagem de templates */
    }
    return { tenantId, integracoes };
  }

  async updateIntegracoes(tenantId: string, dto: UpdateIntegracoesDto) {
    await this.ensureTenant(tenantId);
    const current = await this.getParametros(tenantId);
    const googleJson = dto.googleVision?.credentialsJson;
    if (googleJson?.trim()) {
      try {
        parseGoogleServiceAccountJson(googleJson);
      } catch (err) {
        throw new BadRequestException((err as Error).message);
      }
    }
    const integracoesCredenciais = mergeIntegracoesCredenciais(
      current.parametros.integracoesCredenciais,
      dto,
    );
    const merged = mergeTenantParametros({ ...current.parametros, integracoesCredenciais });
    const row = await this.prisma.tenantConfig.findFirst({
      where: { OR: [{ tenantId }, { tenantKey: tenantId }] },
    });
    if (!row) throw new NotFoundException(`Config não encontrada para tenant ${tenantId}`);

    await this.prisma.tenantConfig.update({
      where: { id: row.id },
      data: { parametros: merged as object },
    });
    await this.cache.invalidate(this.cacheKey(tenantId));
    this.integrationCreds.remember(tenantId, merged.integracoesCredenciais, {
      certificadoBase64: merged.nfse?.certificadoBase64,
      certificadoSenha: merged.nfse?.certificadoSenha,
    });

    const actor = this.auditContext.resolveActor();
    await appendAuditTrailEntry(this.prisma, actor, {
      entidadeId: row.id,
      entidadeTipo: 'TENANT_CONFIG',
      categoria: CategoriaAuditLog.OPERACIONAL,
      acao: 'INTEGRACOES_ATUALIZADAS',
      dadosAnteriores: { tenantId },
      dadosNovos: { tenantId, integracoes: this.probes.buildIntegracoesStatus(tenantId) },
    });

    return this.getIntegracoes(tenantId);
  }

  async testIntegracao(
    tenantId: string,
    id:
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
    await this.ensureTenant(tenantId);
    return this.tenantCtx.run({ tenantId, bypassIsolation: false }, async () => {
      await this.integrationCreds.load(tenantId);
      switch (id) {
        case 'whatsapp':
          return this.probes.testWhatsappConnection();
        case 'google-vision':
          return this.probes.testGoogleVisionConnection();
        case 'google-maps':
          return this.probes.testGoogleMapsConnection();
        case 'google-routes':
          return this.probes.testGoogleRoutesConnection();
        case 'banking':
        case 'boleto':
          return this.probes.testBankingConnection();
        case 'pix':
          return this.probes.testPixConnection();
        case 's3':
          return this.probes.testS3Connection();
        case 'ipm':
          return this.probes.testIpmConnection(tenantId);
        case 'nfse-nacional':
          return this.probes.testNfseNacionalConnection(tenantId);
        default:
          throw new BadRequestException('Integração desconhecida');
      }
    });
  }

  async getMapsConfig(tenantId: string = DEFAULT_TENANT_ID) {
    await this.integrationCreds.load(tenantId);
    const maps = this.integrationCreds.peekGoogleMaps(tenantId);
    return {
      configured: maps.configured,
      apiKey: maps.apiKey ?? '',
      terminalLat: maps.terminalLat ?? null,
      terminalLng: maps.terminalLng ?? null,
    };
  }

  private async ensureTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Terminal ${tenantId} não encontrado`);
    return tenant;
  }

  async getTurnosAgendamento(tenantId: string = DEFAULT_TENANT_ID) {
    const { parametros } = await this.getParametros(tenantId);
    return turnosOperacionaisToLegacy(resolveOperacional(parametros).turnos);
  }

  async calcularCapacidadeAutomatica(tenantId: string = DEFAULT_TENANT_ID) {
    const count = await this.prisma.cadastroPosicaoPatio.count({
      where: { tenantId, ativo: true, deletedAt: null },
    });
    return { capacidadeCalculada: count };
  }

  async getFeriados(tenantId: string, ano: number): Promise<FeriadosResponse> {
    const { parametros } = await this.getParametros(tenantId);
    const feriadosMunicipais = resolveOperacional(parametros).feriadosMunicipais ?? [];

    try {
      const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`, {
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) {
        return { nacionais: [], municipais: feriadosMunicipais };
      }
      const feriadosNacionais = (await response.json()) as FeriadoNacionalApi[];
      return { nacionais: feriadosNacionais, municipais: feriadosMunicipais };
    } catch {
      return { nacionais: [], municipais: feriadosMunicipais };
    }
  }

  /** Datas YYYY-MM-DD de feriados (nacionais + municipais) para um intervalo de anos. */
  async getFeriadosDatas(
    tenantId: string,
    anoInicio: number,
    anoFim: number,
  ): Promise<string[]> {
    const datas = new Set<string>();
    for (let ano = anoInicio; ano <= anoFim; ano++) {
      const { nacionais, municipais } = await this.getFeriados(tenantId, ano);
      for (const f of nacionais) datas.add(f.date);
      for (const f of municipais) datas.add(f.data);
    }
    return [...datas];
  }

  async addFeriadoMunicipal(tenantId: string, data: string, nome: string) {
    const current = await this.getParametros(tenantId);
    const operacional = resolveOperacional(current.parametros);
    const feriados = [...operacional.feriadosMunicipais];
    if (!feriados.some((f) => f.data === data)) {
      feriados.push({ data, nome });
    }
    await this.updateParametros(tenantId, {
      operacional: { ...operacional, feriadosMunicipais: feriados },
    });
    return { ok: true, feriadosMunicipais: feriados };
  }

  async removeFeriadoMunicipal(tenantId: string, data: string) {
    const current = await this.getParametros(tenantId);
    const operacional = resolveOperacional(current.parametros);
    const feriados = operacional.feriadosMunicipais.filter((f) => f.data !== data);
    await this.updateParametros(tenantId, {
      operacional: { ...operacional, feriadosMunicipais: feriados },
    });
    return { ok: true, feriadosMunicipais: feriados };
  }
  async assertTenantExists(tenantId: string) {
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!t) throw new NotFoundException('Tenant não encontrado');
    return t;
  }

  testIpmConnection() {
    return this.probes.testIpmConnection();
  }

  testWhatsappConnection() {
    return this.probes.testWhatsappConnection();
  }

  testGoogleVisionConnection() {
    return this.probes.testGoogleVisionConnection();
  }

  testBankingConnection() {
    return this.probes.testBankingConnection();
  }

  testS3Connection() {
    return this.probes.testS3Connection();
  }

  revalidateWhatsappTemplates() {
    return this.probes.revalidateWhatsappTemplates();
  }

  testSlackWebhook(url: string) {
    return this.probes.testSlackWebhook(url);
  }
}
