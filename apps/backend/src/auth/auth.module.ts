import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { PassportModule } from '@nestjs/passport';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { CxPortaisModule } from '../cx-portais/cx-portais.module';
import { SecurityCenterModule } from '../security-center/security-center.module';
import { TenantModule } from '../tenant/tenant.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SessionModule } from './session/session.module';
import { SessionController } from './session/session.controller';

@Module({
  imports: [
    CxPortaisModule,
    AuditoriaModule,
    SessionModule,
    SecurityCenterModule,
    TenantModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const secret = config.get<string>('secrets.jwtSecret') ?? config.getOrThrow<string>('JWT_SECRET');
        return {
          secret,
          signOptions: {
            expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '1h') as StringValue,
          },
        };
      },
    }),
  ],
  controllers: [AuthController, SessionController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
