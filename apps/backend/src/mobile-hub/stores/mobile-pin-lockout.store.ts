import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveStoreTenantId } from '../../common/stores/store-tenant.util';
import { TenantContextService } from '../../tenant/tenant-context.service';

const JANELA_MS = 900_000;

@Injectable()
export class MobilePinLockoutStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private tenantId() {
    return resolveStoreTenantId(this.tenantCtx);
  }

  private prune(arr: number[], now = Date.now()) {
    return arr.filter((t) => now - t < JANELA_MS);
  }

  async registrarFalha(chave: string) {
    const now = Date.now();
    const row = await this.prisma.mobilePinLockout.findUnique({ where: { deviceId: chave } });
    const prev = row ? (row.falhasJson as number[]) : [];
    const arr = this.prune(prev, now);
    arr.push(now);
    await this.prisma.mobilePinLockout.upsert({
      where: { deviceId: chave },
      create: { tenantId: this.tenantId(), deviceId: chave, falhasJson: arr },
      update: { falhasJson: arr },
    });
  }

  async bloqueado(chave: string, max = 8): Promise<boolean> {
    const row = await this.prisma.mobilePinLockout.findUnique({ where: { deviceId: chave } });
    if (!row) return false;
    const arr = this.prune(row.falhasJson as number[]);
    return arr.length >= max;
  }

  async limpar(chave: string) {
    await this.prisma.mobilePinLockout.deleteMany({ where: { deviceId: chave } });
  }
}
