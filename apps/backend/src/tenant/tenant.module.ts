import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditContextModule } from '../audit-trail/audit-context.module';
import { ConfigCacheModule } from '../common/cache/config-cache.module';
import { EmailModule } from '../common/email/email.module';
import { ObjectStorageModule } from '../common/storage/object-storage.module';
import { FiscalIntegracaoModule } from '../fiscal-integracao/fiscal-integracao.module';
import { NfseNacionalModule } from '../nfse-nacional/nfse-nacional.module';
import { NotificationModule } from '../notification/notification.module';
import { OCRModule } from '../modules/ocr/ocr.module';
import nfseConfig from '../config/nfse.config';
import { PrismaModule } from '../prisma/prisma.module';
import { IntegrationCredentialsModule } from './integration-credentials.module';
import { TenantContextModule } from './tenant-context.module';
import { TenantInterceptor } from './tenant.interceptor';
import { TenantConfigController } from './tenant-config.controller';
import { TenantConfigProbesService } from './tenant-config-probes.service';
import { TenantConfigService } from './tenant-config.service';
import { ActiveTenantsService } from './active-tenants.service';
import { EmpresaOperadoraController } from './empresa-operadora.controller';
import { EmpresaPublicController } from './empresa-public.controller';
import { EmpresaOperadoraService } from './empresa-operadora.service';
import { EmpresaEncargosCronService } from './empresa-encargos.cron';

@Module({
  imports: [
    TenantContextModule,
    IntegrationCredentialsModule,
    PrismaModule,
    AuditContextModule,
    ConfigCacheModule,
    EmailModule,
    ConfigModule.forFeature(nfseConfig),
    FiscalIntegracaoModule,
    NfseNacionalModule,
    NotificationModule,
    OCRModule,
    ObjectStorageModule,
    ScheduleModule,
  ],
  controllers: [TenantConfigController, EmpresaOperadoraController, EmpresaPublicController],
  providers: [
    TenantConfigService,
    TenantConfigProbesService,
    ActiveTenantsService,
    EmpresaOperadoraService,
    EmpresaEncargosCronService,
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
  ],
  exports: [TenantConfigService, ActiveTenantsService, EmpresaOperadoraService],
})
export class TenantModule {}
