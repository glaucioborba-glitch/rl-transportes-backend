import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NfseModule } from '../nfse/nfse.module';
import { NfseNacionalModule } from '../nfse-nacional/nfse-nacional.module';
import { PrismaModule } from '../prisma/prisma.module';
import { IntegrationCredentialsModule } from '../tenant/integration-credentials.module';
import { BankingBoletoService } from './banking-boleto.service';
import { FiscalIpmService } from './fiscal-ipm.service';
import { FiscalNfseRouterService } from './fiscal-nfse-router.service';
import { NfsePollingCronService } from './nfse-polling.cron';

@Module({
  imports: [
    PrismaModule,
    NfseModule,
    NfseNacionalModule,
    ScheduleModule,
    IntegrationCredentialsModule,
  ],
  providers: [
    FiscalIpmService,
    FiscalNfseRouterService,
    BankingBoletoService,
    NfsePollingCronService,
  ],
  exports: [FiscalIpmService, FiscalNfseRouterService, BankingBoletoService],
})
export class FiscalIntegracaoModule {}
