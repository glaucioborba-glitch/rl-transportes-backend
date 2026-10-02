import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveStoreTenantId } from '../../common/stores/store-tenant.util';
import { TenantContextService } from '../../tenant/tenant-context.service';

/** Device binding persistido em PostgreSQL. */
@Injectable()
export class MobileDeviceBindingStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private tenantId() {
    return resolveStoreTenantId(this.tenantCtx);
  }

  async registrar(sub: string, deviceId: string) {
    const norm = deviceId.trim();
    const tenantId = this.tenantId();
    await this.prisma.mobileDeviceBinding.upsert({
      where: { deviceId: norm },
      create: { tenantId, deviceId: norm, userSub: sub },
      update: { userSub: sub, tenantId },
    });
  }

  async dispositivosDoUsuario(sub: string): Promise<string[]> {
    const rows = await this.prisma.mobileDeviceBinding.findMany({
      where: { userSub: sub, tenantId: this.tenantId() },
      select: { deviceId: true },
    });
    return rows.map((r) => r.deviceId);
  }

  async dispositivoLiberado(deviceId: string, sub: string): Promise<boolean> {
    const d = deviceId.trim();
    const row = await this.prisma.mobileDeviceBinding.findUnique({
      where: { deviceId: d },
    });
    return row?.userSub === sub;
  }
}
