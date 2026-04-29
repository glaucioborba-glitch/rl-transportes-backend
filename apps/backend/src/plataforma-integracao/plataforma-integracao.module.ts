import { Module } from '@nestjs/common';
import { PlataformaPublicSurfaceModule } from './plataforma-public-surface.module';
import { PlataformaIntegracaoInternalModule } from './plataforma-internal.module';

/** Fase 18 — API pública comercial, marketplace B2B, multi-tenant simulado, gateway e contratos. */
@Module({
  imports: [PlataformaPublicSurfaceModule, PlataformaIntegracaoInternalModule],
})
export class PlataformaIntegracaoModule {}
