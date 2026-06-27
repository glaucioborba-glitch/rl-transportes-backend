import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingEngineService } from './billing-engine.service';
import { BillingEngineController } from './billing-engine.controller';
import { BillingRuleEngineService } from './billing-rule-engine.service';

@Module({
  imports: [PrismaModule],
  controllers: [BillingEngineController],
  providers: [BillingRuleEngineService, BillingEngineService],
  exports: [BillingRuleEngineService, BillingEngineService],
})
export class BillingEngineModule {}