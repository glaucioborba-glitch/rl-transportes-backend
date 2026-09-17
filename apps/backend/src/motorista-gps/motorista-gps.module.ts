import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { TenantModule } from '../tenant/tenant.module';
import { GoogleRoutesService } from './google-routes.service';
import { MotoristaGpsDriverController } from './motorista-gps-driver.controller';
import { MotoristaGpsStaffController } from './motorista-gps-staff.controller';
import { MotoristaGpsGuard } from './motorista-gps.guard';
import { MotoristaGpsService } from './motorista-gps.service';

@Module({
  imports: [
    TenantModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const secret = config.get<string>('secrets.jwtSecret') ?? config.getOrThrow<string>('JWT_SECRET');
        return {
          secret,
          signOptions: { expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '12h') as StringValue },
        };
      },
    }),
  ],
  controllers: [MotoristaGpsDriverController, MotoristaGpsStaffController],
  providers: [MotoristaGpsService, MotoristaGpsGuard, GoogleRoutesService],
})
export class MotoristaGpsModule {}
