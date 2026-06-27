import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ServicosLogisticosModule } from '../servicos-logisticos/servicos-logisticos.module';
import { TosEventsModule } from '../tos/tos-events.module';
import { AgendamentosController } from './agendamentos.controller';
import { AgendamentosService } from './agendamentos.service';

@Module({
  imports: [PrismaModule, AuditoriaModule, ServicosLogisticosModule, TosEventsModule],
  controllers: [AgendamentosController],
  providers: [AgendamentosService],
  exports: [AgendamentosService],
})
export class AgendamentosModule {}
