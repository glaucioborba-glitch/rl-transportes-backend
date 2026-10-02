import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from './tenant-context.service';
import { DEFAULT_TENANT_ID } from './tenant.constants';
import {
  resolveBanking,
  resolveGoogleMaps,
  resolveGoogleRoutes,
  resolveGoogleVision,
  resolveIpm,
  resolveNfseNacional,
  resolvePix,
  resolveS3,
  resolveWhatsapp,
  snapshotIntegrationEnv,
  type IpmCertificadoLegado,
  type ResolvedBanking,
  type ResolvedIpm,
  type ResolvedNfseNacional,
  type ResolvedGoogleMaps,
  type ResolvedGoogleRoutes,
  type ResolvedGoogleVision,
  type ResolvedPix,
  type ResolvedS3,
  type ResolvedWhatsapp,
  type TenantIntegracoesCredenciais,
} from './integration-credentials.util';
import { mergeTenantParametros } from './tenant-config.types';

@Injectable()
export class IntegrationCredentialsService {
  private readonly cache = new Map<string, TenantIntegracoesCredenciais>();
  /** Certificado A1 gravado em Parâmetros Fiscais antes da tela de integrações. */
  private readonly certificadoLegado = new Map<string, IpmCertificadoLegado>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  currentTenantId(): string {
    return this.tenantCtx.getTenantId() ?? DEFAULT_TENANT_ID;
  }

  peek(tenantId = this.currentTenantId()): TenantIntegracoesCredenciais {
    return this.cache.get(tenantId) ?? {};
  }

  remember(
    tenantId: string,
    creds: TenantIntegracoesCredenciais | undefined,
    certificadoLegado?: IpmCertificadoLegado,
  ): void {
    this.cache.set(tenantId, creds ?? {});
    if (certificadoLegado) this.certificadoLegado.set(tenantId, certificadoLegado);
  }

  async load(tenantId = this.currentTenantId()): Promise<TenantIntegracoesCredenciais> {
    const cached = this.cache.get(tenantId);
    if (cached) return cached;
    const row = await this.prisma.tenantConfig.findFirst({
      where: { OR: [{ tenantId }, { tenantKey: tenantId }] },
    });
    const parametros = mergeTenantParametros(row?.parametros);
    const creds = parametros.integracoesCredenciais ?? {};
    this.cache.set(tenantId, creds);
    this.certificadoLegado.set(tenantId, {
      certificadoBase64: parametros.nfse?.certificadoBase64,
      certificadoSenha: parametros.nfse?.certificadoSenha,
    });
    return creds;
  }

  async resolveIpm(tenantId = this.currentTenantId()): Promise<ResolvedIpm> {
    const creds = await this.load(tenantId);
    return resolveIpm(snapshotIntegrationEnv(), creds.ipm, this.certificadoLegado.get(tenantId));
  }

  peekIpm(tenantId = this.currentTenantId()): ResolvedIpm {
    return resolveIpm(
      snapshotIntegrationEnv(),
      this.peek(tenantId).ipm,
      this.certificadoLegado.get(tenantId),
    );
  }

  async resolveGoogleVision(tenantId = this.currentTenantId()): Promise<ResolvedGoogleVision> {
    const creds = await this.load(tenantId);
    return resolveGoogleVision(snapshotIntegrationEnv(), creds.googleVision);
  }

  async resolveWhatsapp(tenantId = this.currentTenantId()): Promise<ResolvedWhatsapp> {
    const creds = await this.load(tenantId);
    return resolveWhatsapp(snapshotIntegrationEnv(), creds.whatsapp);
  }

  async resolveBanking(tenantId = this.currentTenantId()): Promise<ResolvedBanking> {
    const creds = await this.load(tenantId);
    return resolveBanking(snapshotIntegrationEnv(), creds.boleto ?? creds.banking);
  }

  async resolvePix(tenantId = this.currentTenantId()): Promise<ResolvedPix> {
    const creds = await this.load(tenantId);
    return resolvePix(snapshotIntegrationEnv(), creds.pix);
  }

  async resolveS3(tenantId = this.currentTenantId()): Promise<ResolvedS3> {
    const creds = await this.load(tenantId);
    return resolveS3(snapshotIntegrationEnv(), creds.s3);
  }

  async resolveGoogleMaps(tenantId = this.currentTenantId()): Promise<ResolvedGoogleMaps> {
    const creds = await this.load(tenantId);
    return resolveGoogleMaps(snapshotIntegrationEnv(), creds.googleMaps);
  }

  async resolveGoogleRoutes(tenantId = this.currentTenantId()): Promise<ResolvedGoogleRoutes> {
    const creds = await this.load(tenantId);
    return resolveGoogleRoutes(snapshotIntegrationEnv(), creds.googleRoutes);
  }

  async resolveNfseNacional(tenantId = this.currentTenantId()): Promise<ResolvedNfseNacional> {
    const creds = await this.load(tenantId);
    return resolveNfseNacional(snapshotIntegrationEnv(), creds.nfseNacional);
  }

  peekNfseNacional(tenantId = this.currentTenantId()): ResolvedNfseNacional {
    return resolveNfseNacional(snapshotIntegrationEnv(), this.peek(tenantId).nfseNacional);
  }

  peekGoogleVision(tenantId = this.currentTenantId()): ResolvedGoogleVision {
    return resolveGoogleVision(snapshotIntegrationEnv(), this.peek(tenantId).googleVision);
  }

  peekWhatsapp(tenantId = this.currentTenantId()): ResolvedWhatsapp {
    return resolveWhatsapp(snapshotIntegrationEnv(), this.peek(tenantId).whatsapp);
  }

  peekBanking(tenantId = this.currentTenantId()): ResolvedBanking {
    const creds = this.peek(tenantId);
    return resolveBanking(snapshotIntegrationEnv(), creds.boleto ?? creds.banking);
  }

  peekPix(tenantId = this.currentTenantId()): ResolvedPix {
    return resolvePix(snapshotIntegrationEnv(), this.peek(tenantId).pix);
  }

  peekS3(tenantId = this.currentTenantId()): ResolvedS3 {
    return resolveS3(snapshotIntegrationEnv(), this.peek(tenantId).s3);
  }

  peekGoogleMaps(tenantId = this.currentTenantId()): ResolvedGoogleMaps {
    return resolveGoogleMaps(snapshotIntegrationEnv(), this.peek(tenantId).googleMaps);
  }

  peekGoogleRoutes(tenantId = this.currentTenantId()): ResolvedGoogleRoutes {
    return resolveGoogleRoutes(snapshotIntegrationEnv(), this.peek(tenantId).googleRoutes);
  }
}
