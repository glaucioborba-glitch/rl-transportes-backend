import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GateUnidadeNotificacaoService } from './gate-unidade-notificacao.service';

@Module({
  imports: [PrismaModule],
  providers: [GateUnidadeNotificacaoService],
  exports: [GateUnidadeNotificacaoService],
})
export class GateUnidadeNotificacaoModule {}
