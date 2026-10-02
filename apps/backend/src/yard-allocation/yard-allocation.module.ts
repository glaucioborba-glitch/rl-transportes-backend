import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { YardAllocationService } from './yard-allocation.service';

@Module({
  imports: [PrismaModule],
  providers: [YardAllocationService],
  exports: [YardAllocationService],
})
export class YardAllocationModule {}
