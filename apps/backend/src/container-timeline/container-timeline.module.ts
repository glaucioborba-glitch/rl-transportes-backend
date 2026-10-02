import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ContainerTimelineAdminController } from './container-timeline-admin.controller';
import { ContainerTimelineService } from './container-timeline.service';

@Module({
  imports: [PrismaModule],
  controllers: [ContainerTimelineAdminController],
  providers: [ContainerTimelineService],
  exports: [ContainerTimelineService],
})
export class ContainerTimelineModule {}
