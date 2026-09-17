import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SecurityEventsModule } from '../security-center/security-events.module';
import { TenantModule } from '../tenant/tenant.module';
import { YardReadModule } from '../yard-read/yard-read.module';
import { PatioSaldoRelatorioService } from './patio-saldo-relatorio.service';
import { PatioV2Controller } from './patio.controller';
import { PatioV2Service } from './patio.service';

@Module({
  imports: [PrismaModule, AuditoriaModule, SecurityEventsModule, YardReadModule, TenantModule],
  controllers: [PatioV2Controller],
  providers: [PatioV2Service, PatioSaldoRelatorioService],
  exports: [PatioV2Service],
})
export class PatioV2Module {}
