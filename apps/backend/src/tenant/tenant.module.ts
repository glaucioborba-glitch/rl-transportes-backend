import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantContextModule } from './tenant-context.module';
import { TenantInterceptor } from './tenant.interceptor';
import { TenantConfigController } from './tenant-config.controller';
import { TenantConfigService } from './tenant-config.service';
import { ActiveTenantsService } from './active-tenants.service';

@Module({
  imports: [TenantContextModule, PrismaModule],
  controllers: [TenantConfigController],
  providers: [
    TenantConfigService,
    ActiveTenantsService,
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
  ],
  exports: [TenantConfigService, ActiveTenantsService],
})
export class TenantModule {}
