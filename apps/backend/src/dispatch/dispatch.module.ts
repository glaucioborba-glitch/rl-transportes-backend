import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { DispatchController } from './dispatch.controller';
import { DispatchService } from './dispatch.service';

@Module({
  imports: [PrismaModule, AuditoriaModule, RealtimeModule],
  controllers: [DispatchController],
  providers: [DispatchService],
  exports: [DispatchService],
})
export class DispatchModule {}
