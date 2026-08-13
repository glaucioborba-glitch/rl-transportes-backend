import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { digestBase64Payload } from '../../integracao-mobilidade/common/integracao-string.util';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveStoreTenantId } from '../../common/stores/store-tenant.util';
import { TenantContextService } from '../../tenant/tenant-context.service';

export type MobileHubCanal = 'portaria' | 'gate_in' | 'gate_out' | 'patio' | 'incidente';

export interface MobileHubOpEntry {
  id: string;
  userId: string;
  canal: MobileHubCanal;
  protocolo?: string;
  recebidoEm: string;
  resumo: Record<string, unknown>;
}

@Injectable()
export class MobileHubOpsStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private tenantId() {
    return resolveStoreTenantId(this.tenantCtx);
  }

  private toEntry(row: {
    id: string;
    userId: string;
    canal: string;
    payload: unknown;
    createdAt: Date;
  }): MobileHubOpEntry {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      userId: row.userId,
      canal: row.canal as MobileHubCanal,
      protocolo: typeof payload.protocolo === 'string' ? payload.protocolo : undefined,
      recebidoEm: row.createdAt.toISOString(),
      resumo: payload,
    };
  }

  async add(p: {
    userId: string;
    canal: MobileHubCanal;
    protocolo?: string;
    imagemBase64?: string;
    extras?: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
  }): Promise<MobileHubOpEntry> {
    const digest = digestBase64Payload(p.imagemBase64);
    const payload: Record<string, unknown> = {
      digest,
      protocolo: p.protocolo,
      ...p.extras,
    };
    const acao = p.protocolo ? `${p.canal}:${p.protocolo}` : p.canal;
    const row = await this.prisma.mobileHubOp.create({
      data: {
        id: randomUUID(),
        tenantId: this.tenantId(),
        userId: p.userId,
        canal: p.canal,
        acao,
        payload: payload as Prisma.InputJsonValue,
        ip: p.ip ?? null,
        userAgent: p.userAgent ?? null,
      },
    });
    return this.toEntry(row);
  }

  async porUsuario(userId: string, limite = 40): Promise<MobileHubOpEntry[]> {
    const rows = await this.prisma.mobileHubOp.findMany({
      where: { tenantId: this.tenantId(), userId },
      orderBy: { createdAt: 'desc' },
      take: limite,
    });
    return rows.map((r) => this.toEntry(r));
  }

  async ultimos(n = 100): Promise<MobileHubOpEntry[]> {
    const rows = await this.prisma.mobileHubOp.findMany({
      where: { tenantId: this.tenantId() },
      orderBy: { createdAt: 'desc' },
      take: n,
    });
    return rows.map((r) => this.toEntry(r));
  }

  async cleanupOlderThan(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await this.prisma.mobileHubOp.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return result.count;
  }
}
