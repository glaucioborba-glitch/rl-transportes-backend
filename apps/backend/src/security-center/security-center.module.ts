import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { SessionModule } from '../auth/session/session.module';
import { SecurityEngineModule } from '../security-engine/security-engine.module';
import { SecurityAdminController } from './security-admin.controller';
import { SecurityAnalyticsService } from './security-analytics.service';
import { LoginTelemetryService } from './login-telemetry.service';
import { SecurityEventsModule } from './security-events.module';
import { PortalSecurityService } from './portal-security.service';

@Module({
  imports: [PrismaModule, SessionModule, RedisModule, SecurityEventsModule, SecurityEngineModule],
  controllers: [SecurityAdminController],
  providers: [SecurityAnalyticsService, LoginTelemetryService, PortalSecurityService],
  exports: [
    SecurityAnalyticsService,
    LoginTelemetryService,
    PortalSecurityService,
    SecurityEventsModule,
  ],
})
export class SecurityCenterModule {}
