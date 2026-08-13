import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { SessionModule } from '../auth/session/session.module';
import { CxPortaisModule } from '../cx-portais/cx-portais.module';
import { SolicitacoesV2Module } from '../modules/solicitacoes-v2/solicitacoes-v2.module';
import { PessoasPermissoesModule } from '../pessoas-permissoes/pessoas-permissoes.module';
import { PdfOperacionalV2Controller } from './pdf-operacional-v2.controller';
import { PdfOperacionalV2Service } from './pdf-operacional-v2.service';
import { PdfSolicitacaoV2AccessGuard } from './pdf-solicitacao-v2-access.guard';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    SessionModule,
    CxPortaisModule,
    SolicitacoesV2Module,
    PessoasPermissoesModule,
  ],
  controllers: [PdfOperacionalV2Controller],
  providers: [PdfOperacionalV2Service, PdfSolicitacaoV2AccessGuard],
  exports: [PdfOperacionalV2Service],
})
export class PdfOperacionalV2Module {}
