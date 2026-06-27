import { Injectable } from '@nestjs/common';
import { TenantStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_TENANT_ID } from './tenant.constants';

@Injectable()
export class ActiveTenantsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tenants com status ATIVO — fallback `default` se tabela vazia (dev legado). */
  async listActiveTenantIds(): Promise<string[]> {
    const rows = await this.prisma.tenant.findMany({
      where: { status: TenantStatus.ATIVO },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    if (rows.length === 0) return [DEFAULT_TENANT_ID];
    return rows.map((r) => r.id);
  }
}
