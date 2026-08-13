import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { ServicosLogisticosModule } from '../servicos-logisticos/servicos-logisticos.module';
import { SolicitacoesController } from './solicitacoes.controller';
import { SolicitacoesService } from './solicitacoes.service';

@Module({
  imports: [AuditoriaModule, ServicosLogisticosModule],
  controllers: [SolicitacoesController],
  providers: [SolicitacoesService],
  exports: [SolicitacoesService],
})
export class SolicitacoesModule {}
