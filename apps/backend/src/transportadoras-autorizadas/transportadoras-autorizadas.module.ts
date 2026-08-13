import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { JwtModule } from '@nestjs/jwt';
import { PasswordPolicyModule } from '../common/security/password-policy.module';
import {
  CxPortalAuthGuard,
  CxPortalPublicApiForbidGuard,
} from '../cx-portais/guards/cx-portal-auth.guard';
import { PortalFornecedorIdentitiesStore } from '../cx-portais/stores/portal-fornecedor-identities.store';
import { PortalJwtService } from '../cx-portais/identity/portal-jwt.service';
import { PessoasPermissoesModule } from '../pessoas-permissoes/pessoas-permissoes.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SessionModule } from '../auth/session/session.module';
import { TransportadorasAutorizadasController } from './transportadoras-autorizadas.controller';
import { TransportadorasAutorizadasService } from './transportadoras-autorizadas.service';

@Module({
  imports: [
    PrismaModule,
    SessionModule,
    ConfigModule,
    PasswordPolicyModule,
    PessoasPermissoesModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('secrets.jwtSecret') ?? config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '1h') as StringValue,
        },
      }),
    }),
  ],
  controllers: [TransportadorasAutorizadasController],
  providers: [
    TransportadorasAutorizadasService,
    PortalJwtService,
    PortalFornecedorIdentitiesStore,
    CxPortalPublicApiForbidGuard,
    CxPortalAuthGuard,
  ],
  exports: [TransportadorasAutorizadasService],
})
export class TransportadorasAutorizadasModule {}
