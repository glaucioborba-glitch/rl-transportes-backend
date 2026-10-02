import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PricingSyncService } from './pricing-sync.service';

@Module({
  imports: [PrismaModule, AuditoriaModule],
  providers: [PricingSyncService],
  exports: [PricingSyncService],
})
export class PricingSyncModule {}
