import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { SecurityEventsModule } from '../security-center/security-events.module';
import { RiskRulesService } from './risk-rules.service';
import { AnomalyMlService } from './anomaly-ml.service';
import { EventCorrelatorService } from './event-correlator.service';
import { IntrusionService } from './intrusion.service';

@Module({
  imports: [PrismaModule, RedisModule, SecurityEventsModule],
  providers: [RiskRulesService, AnomalyMlService, EventCorrelatorService, IntrusionService],
  exports: [IntrusionService],
})
export class SecurityEngineModule {}
