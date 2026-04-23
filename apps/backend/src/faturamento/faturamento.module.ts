import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { NfseModule } from '../nfse/nfse.module';
import { FaturamentoController } from './faturamento.controller';
import { FaturamentoService } from './faturamento.service';

@Module({
  imports: [AuditoriaModule, NfseModule],
  controllers: [FaturamentoController],
  providers: [FaturamentoService],
  exports: [FaturamentoService],
})
export class FaturamentoModule {}
