import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { AuthModule } from './auth/auth.module';
import { ClientesModule } from './clientes/clientes.module';
import secretsConfig from './config/secrets.config';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { SolicitacoesModule } from './solicitacoes/solicitacoes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      load: [secretsConfig],
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 300_000,
    }),
    PrismaModule,
    RedisModule,
    AuditoriaModule,
    AuthModule,
    ClientesModule,
    SolicitacoesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
