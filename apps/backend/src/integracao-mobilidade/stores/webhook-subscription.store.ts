import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { resolveStoreTenantId } from '../../common/stores/store-tenant.util';
import type { IntegracaoTipoEvento } from '../integracao-events.constants';

export interface WebhookSubscription {
  id: string;
  url: string;
  secret: string;
  eventos: IntegracaoTipoEvento[];
  createdAt: string;
}

@Injectable()
export class WebhookSubscriptionStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private tenantId() {
    return resolveStoreTenantId(this.tenantCtx);
  }

  async register(input: Omit<WebhookSubscription, 'id' | 'createdAt'>): Promise<WebhookSubscription> {
    const id = randomUUID();
    const row = await this.prisma.webhookSubscription.create({
      data: {
        id,
        tenantId: this.tenantId(),
        url: input.url,
        secret: input.secret,
        eventos: input.eventos,
      },
    });
    return this.mapRow(row);
  }

  async list(): Promise<WebhookSubscription[]> {
    const rows = await this.prisma.webhookSubscription.findMany({
      where: { tenantId: this.tenantId() },
    });
    return rows.map((r) => this.mapRow(r));
  }

  async get(id: string): Promise<WebhookSubscription | undefined> {
    const row = await this.prisma.webhookSubscription.findFirst({
      where: { id, tenantId: this.tenantId() },
    });
    return row ? this.mapRow(row) : undefined;
  }

  /** Assinaturas que escutam o tipo informado. */
  async matching(tipo: IntegracaoTipoEvento): Promise<WebhookSubscription[]> {
    const all = await this.list();
    return all.filter((s) => s.eventos.includes(tipo));
  }

  private mapRow(row: {
    id: string;
    url: string;
    secret: string;
    eventos: unknown;
    createdAt: Date;
  }): WebhookSubscription {
    return {
      id: row.id,
      url: row.url,
      secret: row.secret,
      eventos: Array.isArray(row.eventos) ? (row.eventos as IntegracaoTipoEvento[]) : [],
      createdAt: row.createdAt.toISOString(),
    };
  }
}
