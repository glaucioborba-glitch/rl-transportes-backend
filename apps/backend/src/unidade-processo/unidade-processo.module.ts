import { Module, forwardRef } from '@nestjs/common';
import { ArmazenagemFaturamentoModule } from '../armazenagem-faturamento/armazenagem-faturamento.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { AuthModule } from '../auth/auth.module';
import { CadastrosTabelasServicosService } from '../cadastros/cadastros-tabelas-servicos.service';
import { OutboxModule } from '../outbox/outbox.module';
import { PatioV2Module } from '../patio-v2/patio.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UnidadeProcessoController } from './unidade-processo.controller';
import { ServicoEfeitoAplicarService } from './servico-efeito-aplicar.service';
import { UnidadeProcessoServicosService } from './unidade-processo-servicos.service';
import { UnidadeProcessoService } from './unidade-processo.service';

@Module({
  imports: [
    PrismaModule,
    PatioV2Module,
    ArmazenagemFaturamentoModule,
    OutboxModule,
    AuditoriaModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [UnidadeProcessoController],
  providers: [
    UnidadeProcessoService,
    UnidadeProcessoServicosService,
    ServicoEfeitoAplicarService,
    CadastrosTabelasServicosService,
  ],
  exports: [UnidadeProcessoService],
})
export class UnidadeProcessoModule {}
