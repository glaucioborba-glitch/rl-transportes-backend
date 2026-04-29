import { Module } from '@nestjs/common';
import { PlataformaCoreModule } from './plataforma-core.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { PlataformaMarketplaceAdminController } from './controllers/plataforma-marketplace-admin.controller';
import { PlataformaTenantController } from './controllers/plataforma-tenant.controller';
import { PlataformaGatewayController } from './controllers/plataforma-gateway.controller';
import { PlataformaContractsController } from './controllers/plataforma-contracts.controller';
import { PlataformaGovernancaController } from './controllers/plataforma-governanca.controller';
import { PlataformaInternalAdminController } from './controllers/plataforma-internal-admin.controller';

@Module({
  imports: [PlataformaCoreModule, AuditoriaModule],
  controllers: [
    PlataformaMarketplaceAdminController,
    PlataformaTenantController,
    PlataformaGatewayController,
    PlataformaContractsController,
    PlataformaGovernancaController,
    PlataformaInternalAdminController,
  ],
})
export class PlataformaIntegracaoInternalModule {}
