import { Module } from '@nestjs/common';
import { AuditContextModule } from '../audit-trail/audit-context.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ServicosLogisticosModule } from '../servicos-logisticos/servicos-logisticos.module';
import { TenantModule } from '../tenant/tenant.module';
import { TosEventsModule } from '../tos/tos-events.module';
import { AgendamentosController } from './agendamentos.controller';
import { AgendamentosService } from './agendamentos.service';

@Module({
  imports: [
    PrismaModule,
    AuditoriaModule,
    AuditContextModule,
    ServicosLogisticosModule,
    TosEventsModule,
    TenantModule,
  ],
  controllers: [AgendamentosController],
  providers: [AgendamentosService],
  exports: [AgendamentosService],
})
export class AgendamentosModule {}
