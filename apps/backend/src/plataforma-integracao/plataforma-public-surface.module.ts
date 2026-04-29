import { Module } from '@nestjs/common';
import { PlataformaCoreModule } from './plataforma-core.module';
import { PlataformaPublicV1Controller } from './controllers/plataforma-public-v1.controller';
import { PlataformaMarketplaceCatalogController } from './controllers/plataforma-marketplace-catalog.controller';

/** Superfície pública — usada também pelo Swagger `/docs/public` (sem rotas internas JWT). */
@Module({
  imports: [PlataformaCoreModule],
  controllers: [PlataformaPublicV1Controller, PlataformaMarketplaceCatalogController],
})
export class PlataformaPublicSurfaceModule {}
