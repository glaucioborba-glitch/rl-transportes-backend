import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PortalNotificacaoService } from './portal-notificacao.service';

@Module({
  imports: [PrismaModule],
  providers: [PortalNotificacaoService],
  exports: [PortalNotificacaoService],
})
export class PortalNotificacoesModule {}
