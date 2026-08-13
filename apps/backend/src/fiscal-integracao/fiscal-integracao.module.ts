import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NfseModule } from '../nfse/nfse.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BankingBoletoService } from './banking-boleto.service';
import { FiscalIpmService } from './fiscal-ipm.service';
import { NfsePollingCronService } from './nfse-polling.cron';

@Module({
  imports: [PrismaModule, NfseModule, ScheduleModule],
  providers: [FiscalIpmService, BankingBoletoService, NfsePollingCronService],
  exports: [FiscalIpmService, BankingBoletoService],
})
export class FiscalIntegracaoModule {}
