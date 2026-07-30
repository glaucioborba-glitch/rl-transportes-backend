import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AuditContextModule } from '../audit-trail/audit-context.module';
import { ConfigCacheModule } from '../common/cache/config-cache.module';
import { ObjectStorageModule } from '../common/storage/object-storage.module';
import { FiscalIntegracaoModule } from '../fiscal-integracao/fiscal-integracao.module';
import { NotificationModule } from '../notification/notification.module';
import { OCRModule } from '../modules/ocr/ocr.module';
import nfseConfig from '../config/nfse.config';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantContextModule } from './tenant-context.module';
import { TenantInterceptor } from './tenant.interceptor';
import { TenantConfigController } from './tenant-config.controller';
import { TenantConfigProbesService } from './tenant-config-probes.service';
import { TenantConfigService } from './tenant-config.service';
import { ActiveTenantsService } from './active-tenants.service';

@Module({
  imports: [
    TenantContextModule,
    PrismaModule,
    AuditContextModule,
    ConfigCacheModule,
    ConfigModule.forFeature(nfseConfig),
    FiscalIntegracaoModule,
    NotificationModule,
    OCRModule,
    ObjectStorageModule,
  ],
  controllers: [TenantConfigController],
  providers: [
    TenantConfigService,
    TenantConfigProbesService,
    ActiveTenantsService,
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
  ],
  exports: [TenantConfigService, ActiveTenantsService],
})
export class TenantModule {}
