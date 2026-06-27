import { Module } from '@nestjs/common';
import { ArmazenagemFaturamentoCronModule } from '../../armazenagem-faturamento/armazenagem-faturamento-cron.module';
import { DunningCronModule } from '../../dunning/dunning-cron.module';
import { ArmazenagemFaturamentoModule } from '../../armazenagem-faturamento/armazenagem-faturamento.module';
import { FaturamentoModule } from '../../faturamento/faturamento.module';
import { FinanceiroConciliacaoModule } from '../../financeiro-conciliacao/financeiro-conciliacao.module';
import { CnabModule } from '../../cnab/cnab.module';
import { FiscalIntegracaoModule } from '../../fiscal-integracao/fiscal-integracao.module';
import { OutboxModule } from '../../outbox/outbox.module';
import { TesourariaModule } from '../../tesouraria/tesouraria.module';
import { isBillingCronLazy } from '../phase-imports';

/**
 * Bounded Context — Faturamento (Billing).
 * CRON diárias, outbox, integração fiscal IPM e boleto/PIX.
 */
@Module({
  imports: [
    OutboxModule,
    FiscalIntegracaoModule,
    ArmazenagemFaturamentoModule,
    ...(isBillingCronLazy() ? [] : [ArmazenagemFaturamentoCronModule, DunningCronModule]),
    FaturamentoModule,
    FinanceiroConciliacaoModule,
    CnabModule,
    TesourariaModule,
  ],
  exports: [
    OutboxModule,
    FiscalIntegracaoModule,
    ArmazenagemFaturamentoModule,
    FaturamentoModule,
  ],
})
export class BillingDomainModule {}
