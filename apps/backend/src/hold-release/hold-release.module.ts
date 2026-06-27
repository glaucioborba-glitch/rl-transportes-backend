import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';
import { HoldReleaseService } from './hold-release.service';

@Module({
  imports: [PrismaModule, TenantModule],
  providers: [HoldReleaseService],
  exports: [HoldReleaseService],
})
export class HoldReleaseModule {}
