import { Module } from '@nestjs/common';
import { ArmazenagemFaturamentoModule } from '../armazenagem-faturamento/armazenagem-faturamento.module';
import { CadastrosTabelasAluguelService } from '../cadastros/cadastros-tabelas-aluguel.service';
import { OutboxModule } from '../outbox/outbox.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AluguelController } from './aluguel.controller';
import { AluguelService } from './aluguel.service';
import { SolicitacaoAluguelService } from './solicitacao-aluguel.service';

@Module({
  imports: [PrismaModule, ArmazenagemFaturamentoModule, OutboxModule],
  controllers: [AluguelController],
  providers: [AluguelService, SolicitacaoAluguelService, CadastrosTabelasAluguelService],
  exports: [AluguelService, SolicitacaoAluguelService],
})
export class AluguelModule {}
