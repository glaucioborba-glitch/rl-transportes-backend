import { Module } from '@nestjs/common';
import { CxPortaisModule } from '../../cx-portais/cx-portais.module';
import { PessoasAutorizadasModule } from '../../pessoas-autorizadas/pessoas-autorizadas.module';
import { PessoasPermissoesModule } from '../../pessoas-permissoes/pessoas-permissoes.module';
import { PlataformaIntegracaoModule } from '../../plataforma-integracao/plataforma-integracao.module';
import { TransportadorasAutorizadasModule } from '../../transportadoras-autorizadas/transportadoras-autorizadas.module';

/**
 * Bounded Context — Portal do Cliente (APIs CX, JWT portal).
 */
@Module({
  imports: [
    CxPortaisModule,
    PessoasAutorizadasModule,
    PessoasPermissoesModule,
    TransportadorasAutorizadasModule,
    PlataformaIntegracaoModule,
  ],
  exports: [
    CxPortaisModule,
    PessoasAutorizadasModule,
    PessoasPermissoesModule,
    TransportadorasAutorizadasModule,
  ],
})
export class PortalClientDomainModule {}
