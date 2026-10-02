import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkforcePlanningModule } from '../workforce-planning/workforce-planning.module';
import { WorkforceRhController } from './workforce-rh.controller';
import { WorkforceRhService } from './workforce-rh.service';

@Module({
  imports: [PrismaModule, WorkforcePlanningModule],
  controllers: [WorkforceRhController],
  providers: [WorkforceRhService],
  exports: [WorkforceRhService],
})
export class WorkforceRhModule {}
