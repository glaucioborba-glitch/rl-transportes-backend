import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { NfseModule } from '../nfse/nfse.module';
import { HoldReleaseModule } from '../hold-release/hold-release.module';
import { FaturamentoController } from './faturamento.controller';
import { FaturamentoService } from './faturamento.service';

@Module({
  imports: [AuditoriaModule, NfseModule, HoldReleaseModule],
  controllers: [FaturamentoController],
  providers: [FaturamentoService],
  exports: [FaturamentoService],
})
export class FaturamentoModule {}
