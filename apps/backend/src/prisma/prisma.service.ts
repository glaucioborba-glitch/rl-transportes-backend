import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { ChaosGateService } from '../chaos/chaos-gate.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { AuditContextService } from '../audit-trail/audit-context.service';
import { createAuditTrailExtension } from '../audit-trail/audit-trail.prisma-extension';
import { DEFAULT_TENANT_ID, TENANT_SCOPED_MODELS } from '../tenant/tenant.constants';

type PoolHolder = { __pool?: Pool };

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor(
    config: ConfigService,
    @Optional() chaosGate?: ChaosGateService,
    @Optional() tenantContext?: TenantContextService,
    @Optional() auditContext?: AuditContextService,
  ) {
    const url = config.getOrThrow<string>('DATABASE_URL');
    const pool = new Pool({ connectionString: url });
    super({ adapter: new PrismaPg(pool) });
    this.pool = pool;
    (this as unknown as PoolHolder).__pool = pool;

    let client: PrismaService = this;

    if (tenantContext) {
      client = this.$extends({
        query: {
          $allModels: {
            async $allOperations({ model, operation, args, query }) {
              if (!TENANT_SCOPED_MODELS.has(model)) {
                return query(args);
              }
              if (tenantContext.isBypass()) {
                return query(args);
              }
              const tenantId = tenantContext.getTenantId() ?? DEFAULT_TENANT_ID;

              if (
                operation === 'findMany' ||
                operation === 'findFirst' ||
                operation === 'findUnique' ||
                operation === 'count' ||
                operation === 'aggregate' ||
                operation === 'groupBy'
              ) {
                args.where = { ...(args.where ?? {}), tenantId };
              }

              if (operation === 'create' || operation === 'createMany') {
                if (operation === 'create') {
                  const data = args.data as Record<string, unknown>;
                  data.tenantId = (data.tenantId as string | undefined) ?? tenantId;
                } else if (Array.isArray(args.data)) {
                  args.data = args.data.map((row: Record<string, unknown>) => ({
                    ...row,
                    tenantId: (row.tenantId as string | undefined) ?? tenantId,
                  })) as typeof args.data;
                }
              }

              if (operation === 'update' || operation === 'updateMany' || operation === 'delete' || operation === 'deleteMany') {
                args.where = { ...(args.where ?? {}), tenantId };
              }

              return query(args);
            },
          },
        },
      }) as unknown as PrismaService;
      (client as unknown as PoolHolder).__pool = pool;
    }

    if (auditContext) {
      client = client.$extends(createAuditTrailExtension(auditContext)) as unknown as PrismaService;
      (client as unknown as PoolHolder).__pool = pool;
    }

    if (!chaosGate) {
      return client;
    }

    const withChaos = client.$extends({
      query: {
        $allOperations({ args, query }) {
          chaosGate.assertDbAvailable();
          return query(args);
        },
      },
    }) as unknown as PrismaService;
    (withChaos as unknown as PoolHolder).__pool = pool;
    return withChaos;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    const p = (this as unknown as PoolHolder).__pool ?? this.pool;
    if (p) await p.end();
  }
}
