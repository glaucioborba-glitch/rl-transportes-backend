import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GrcComplianceAccessGuard } from './grc-compliance-access.guard';
import { GrcComplianceController } from './grc-compliance.controller';
import { GrcComplianceService } from './grc-compliance.service';
import { GrcComplianceStoreService } from './grc-compliance-store.service';

@Module({
  imports: [PrismaModule],
  controllers: [GrcComplianceController],
  providers: [GrcComplianceService, GrcComplianceStoreService, GrcComplianceAccessGuard],
})
export class GrcComplianceModule {}
