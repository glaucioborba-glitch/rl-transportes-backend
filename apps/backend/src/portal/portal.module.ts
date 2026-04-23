import { Module } from '@nestjs/common';
import { FaturamentoModule } from '../faturamento/faturamento.module';
import { SolicitacoesModule } from '../solicitacoes/solicitacoes.module';
import { PortalController } from './portal.controller';

@Module({
  imports: [SolicitacoesModule, FaturamentoModule],
  controllers: [PortalController],
})
export class PortalModule {}
