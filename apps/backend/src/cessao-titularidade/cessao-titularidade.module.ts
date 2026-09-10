import { Module } from '@nestjs/common';
import { ArmazenagemFaturamentoModule } from '../armazenagem-faturamento/armazenagem-faturamento.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CessaoTitularidadeController } from './cessao-titularidade.controller';
import { CessaoTitularidadeService } from './cessao-titularidade.service';

@Module({
  imports: [PrismaModule, AuthModule, AuditoriaModule, ArmazenagemFaturamentoModule],
  controllers: [CessaoTitularidadeController],
  providers: [CessaoTitularidadeService],
  exports: [CessaoTitularidadeService],
})
export class CessaoTitularidadeModule {}
