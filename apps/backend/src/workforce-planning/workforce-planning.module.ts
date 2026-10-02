import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkforcePlanningService } from './workforce-planning.service';

@Module({
  imports: [PrismaModule],
  providers: [WorkforcePlanningService],
  exports: [WorkforcePlanningService],
})
export class WorkforcePlanningModule {}
