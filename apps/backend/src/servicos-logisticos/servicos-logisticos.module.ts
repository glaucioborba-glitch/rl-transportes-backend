import { Module } from '@nestjs/common';
import { SecurityEventsModule } from '../security-center/security-events.module';
import { ServicosLogisticosService } from './servicos-logisticos.service';

@Module({
  imports: [SecurityEventsModule],
  providers: [ServicosLogisticosService],
  exports: [ServicosLogisticosService],
})
export class ServicosLogisticosModule {}
