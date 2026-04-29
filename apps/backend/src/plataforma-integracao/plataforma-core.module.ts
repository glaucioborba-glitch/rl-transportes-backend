import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlataformaTenantStore } from './stores/plataforma-tenant.store';
import { PlataformaApiClientStore } from './stores/plataforma-api-client.store';
import { PlataformaConsumptionStore } from './stores/plataforma-consumption.store';
import { PlataformaRateLimitService } from './services/plataforma-rate-limit.service';
import { PlataformaPublicAuthGuard } from './guards/plataforma-public-auth.guard';
import { PlataformaIpAllowlistGuard } from './guards/plataforma-ip-allowlist.guard';
import { PlataformaPublicDataService } from './plataforma-public-data.service';
import { PlataformaMarketplaceService } from './services/plataforma-marketplace.service';
import { PlataformaContractsService } from './services/plataforma-contracts.service';
import { PlataformaConsumoInterceptor } from './interceptors/plataforma-consumo.interceptor';

@Module({
  imports: [PrismaModule],
  providers: [
    PlataformaTenantStore,
    PlataformaApiClientStore,
    PlataformaConsumptionStore,
    PlataformaRateLimitService,
    PlataformaPublicAuthGuard,
    PlataformaIpAllowlistGuard,
    PlataformaPublicDataService,
    PlataformaMarketplaceService,
    PlataformaContractsService,
    PlataformaConsumoInterceptor,
  ],
  exports: [
    PlataformaTenantStore,
    PlataformaApiClientStore,
    PlataformaConsumptionStore,
    PlataformaRateLimitService,
    PlataformaPublicAuthGuard,
    PlataformaIpAllowlistGuard,
    PlataformaPublicDataService,
    PlataformaMarketplaceService,
    PlataformaContractsService,
    PlataformaConsumoInterceptor,
  ],
})
export class PlataformaCoreModule {}
