import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PlataformaCoreModule } from '../plataforma-integracao/plataforma-core.module';
import { MobileAuthController } from './controllers/mobile-auth.controller';
import { MobileV1OperadorController } from './controllers/mobile-v1-operador.controller';
import { MobileV1MotoristaController } from './controllers/mobile-v1-motorista.controller';
import { MobileV1ClienteController } from './controllers/mobile-v1-cliente.controller';
import { MobileV1SyncController } from './controllers/mobile-v1-sync.controller';
import { MobileV1TelemetryController } from './controllers/mobile-v1-telemetry.controller';
import { MobileV1AdminController, MobileV1PushController } from './controllers/mobile-v1-push-admin.controller';
import { MobileV2HealthController } from './controllers/mobile-v2-health.controller';
import { MobileBiometricGuard } from './guards/mobile-biometric.guard';
import { MobileJwtAuthGuard } from './guards/mobile-jwt-auth.guard';
import { MobileRoleGuard } from './guards/mobile-role.guard';
import { MobileIdentityService } from './identity/mobile-identity.service';
import { MobileJwtService } from './identity/mobile-jwt.service';
import { MobileHubClienteService } from './services/mobile-hub-cliente.service';
import { MobileHubMotoristaService } from './services/mobile-hub-motorista.service';
import { MobileHubOperadorService } from './services/mobile-hub-operador.service';
import { MobileSyncService } from './services/mobile-sync.service';
import { MobileDeviceBindingStore } from './stores/mobile-device-binding.store';
import { MobileHubOpsStore } from './stores/mobile-hub-ops.store';
import { MobileMotoristaIdentitiesStore } from './stores/mobile-motorista-identities.store';
import { MobileOfflineSyncStore } from './stores/mobile-offline-sync.store';
import { MobilePinLockoutStore } from './stores/mobile-pin-lockout.store';
import { MobilePushStore } from './stores/mobile-push.store';
import { MobileTelemetryStore } from './stores/mobile-telemetry.store';

/**
 * Fase 21 — mobile-hub: API `/mobile/v1`, telemetria, sync offline (LWW), push em memória, JWT dedicado.
 * Apps nativos Android/iOS consomem este módulo; sem migrations nesta fase.
 */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuditoriaModule,
    PlataformaCoreModule,
    AuthModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const secret =
          config.get<string>('MOBILE_JWT_SECRET') ??
          `${config.getOrThrow<string>('JWT_SECRET')}:mobile`;
        return {
          secret,
          signOptions: {
            expiresIn: (config.get<string>('MOBILE_JWT_EXPIRES_IN') ?? '45m') as StringValue,
          },
        };
      },
    }),
  ],
  controllers: [
    MobileAuthController,
    MobileV1OperadorController,
    MobileV1MotoristaController,
    MobileV1ClienteController,
    MobileV1SyncController,
    MobileV1TelemetryController,
    MobileV1PushController,
    MobileV1AdminController,
    MobileV2HealthController,
  ],
  providers: [
    MobileJwtService,
    MobileIdentityService,
    MobileDeviceBindingStore,
    MobileMotoristaIdentitiesStore,
    MobileOfflineSyncStore,
    MobilePushStore,
    MobileTelemetryStore,
    MobileHubOpsStore,
    MobilePinLockoutStore,
    MobileHubOperadorService,
    MobileHubMotoristaService,
    MobileHubClienteService,
    MobileSyncService,
    MobileJwtAuthGuard,
    MobileRoleGuard,
    MobileBiometricGuard,
  ],
  exports: [MobileTelemetryStore, MobileHubOpsStore, MobilePushStore],
})
export class MobileHubModule {}
