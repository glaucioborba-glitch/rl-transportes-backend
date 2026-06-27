import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { SessionModule } from '../auth/session/session.module';
import { PortalJwtService } from '../cx-portais/identity/portal-jwt.service';
import {
  CxPortalAuthGuard,
  CxPortalPublicApiForbidGuard,
} from '../cx-portais/guards/cx-portal-auth.guard';
import { PortalFornecedorIdentitiesStore } from '../cx-portais/stores/portal-fornecedor-identities.store';
import { PessoasAutorizadasService } from './pessoas-autorizadas.service';
import { PessoasAutorizadasClienteController } from './pessoas-autorizadas.controller';
import { PortalAuthPessoaController } from './portal-auth-pessoa.controller';

import { PessoasPermissoesModule } from '../pessoas-permissoes/pessoas-permissoes.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [
    PrismaModule,
    SessionModule,
    ConfigModule,
    AuditoriaModule,
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
  controllers: [PessoasAutorizadasClienteController, PortalAuthPessoaController],
  providers: [
    PessoasAutorizadasService,
    PortalJwtService,
    PortalFornecedorIdentitiesStore,
    CxPortalPublicApiForbidGuard,
    CxPortalAuthGuard,
  ],
  exports: [PessoasAutorizadasService],
})
export class PessoasAutorizadasModule {}
