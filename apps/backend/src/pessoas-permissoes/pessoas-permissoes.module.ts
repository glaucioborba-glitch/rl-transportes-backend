import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { SecurityCenterModule } from '../security-center/security-center.module';
import { PortalJwtService } from '../cx-portais/identity/portal-jwt.service';
import {
  CxPortalAuthGuard,
  CxPortalPublicApiForbidGuard,
} from '../cx-portais/guards/cx-portal-auth.guard';
import { PortalFornecedorIdentitiesStore } from '../cx-portais/stores/portal-fornecedor-identities.store';
import { SessionModule } from '../auth/session/session.module';
import { PessoaPermissoesGuard } from '../common/guards/pessoa-permissoes.guard';
import { PessoasPermissoesService } from './pessoas-permissoes.service';

@Module({
  imports: [
    PrismaModule,
    SessionModule,
    AuditoriaModule,
    SecurityCenterModule,
    ConfigModule,
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
  controllers: [],
  providers: [
    PessoasPermissoesService,
    PessoaPermissoesGuard,
    PortalJwtService,
    PortalFornecedorIdentitiesStore,
    CxPortalPublicApiForbidGuard,
    CxPortalAuthGuard,
  ],
  exports: [PessoasPermissoesService, PessoaPermissoesGuard],
})
export class PessoasPermissoesModule {}
