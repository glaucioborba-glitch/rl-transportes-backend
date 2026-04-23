import { Module } from '@nestjs/common';
import { NfseController } from './nfse.controller';
import { IpmNfseAdapter } from './nfse.adapter';
import { NfseService } from './nfse.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [NfseController],
  providers: [IpmNfseAdapter, NfseService],
  exports: [NfseService, IpmNfseAdapter],
})
export class NfseModule {}
