import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from './tenant-context.service';
import { DEFAULT_TENANT_ID } from './tenant.constants';
import {
  resolveBanking,
  resolveGoogleVision,
  resolveS3,
  resolveWhatsapp,
  snapshotIntegrationEnv,
  type ResolvedBanking,
  type ResolvedGoogleVision,
  type ResolvedS3,
  type ResolvedWhatsapp,
  type TenantIntegracoesCredenciais,
} from './integration-credentials.util';
import { mergeTenantParametros } from './tenant-config.types';

@Injectable()
export class IntegrationCredentialsService {
  private readonly cache = new Map<string, TenantIntegracoesCredenciais>();

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

  remember(tenantId: string, creds: TenantIntegracoesCredenciais | undefined): void {
    this.cache.set(tenantId, creds ?? {});
  }

  async load(tenantId = this.currentTenantId()): Promise<TenantIntegracoesCredenciais> {
    const cached = this.cache.get(tenantId);
    if (cached) return cached;
    const row = await this.prisma.tenantConfig.findFirst({
      where: { OR: [{ tenantId }, { tenantKey: tenantId }] },
    });
    const creds = mergeTenantParametros(row?.parametros).integracoesCredenciais ?? {};
    this.cache.set(tenantId, creds);
    return creds;
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
    return resolveBanking(snapshotIntegrationEnv(), creds.banking);
  }

  async resolveS3(tenantId = this.currentTenantId()): Promise<ResolvedS3> {
    const creds = await this.load(tenantId);
    return resolveS3(snapshotIntegrationEnv(), creds.s3);
  }

  peekGoogleVision(tenantId = this.currentTenantId()): ResolvedGoogleVision {
    return resolveGoogleVision(snapshotIntegrationEnv(), this.peek(tenantId).googleVision);
  }

  peekWhatsapp(tenantId = this.currentTenantId()): ResolvedWhatsapp {
    return resolveWhatsapp(snapshotIntegrationEnv(), this.peek(tenantId).whatsapp);
  }

  peekBanking(tenantId = this.currentTenantId()): ResolvedBanking {
    return resolveBanking(snapshotIntegrationEnv(), this.peek(tenantId).banking);
  }

  peekS3(tenantId = this.currentTenantId()): ResolvedS3 {
    return resolveS3(snapshotIntegrationEnv(), this.peek(tenantId).s3);
  }
}
