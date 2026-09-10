import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';
import { PortalNotificacoesModule } from '../portal-notificacoes/portal-notificacao.module';
import { CadastroFinanceiroController } from './cadastro-financeiro.controller';
import { FinanceiroPendenciasController } from './financeiro-pendencias.controller';
import { FinanceiroClientesCondicoesController } from './financeiro-clientes-condicoes.controller';
import { CadastrosOpcoesPagamentoController } from './cadastros-opcoes-pagamento.controller';
import { CadastroFinanceiroService } from './cadastro-financeiro.service';
import { CondicaoPagamentoService } from './condicao-pagamento.service';

@Module({
  imports: [PrismaModule, TenantModule, PortalNotificacoesModule],
  controllers: [
    CadastroFinanceiroController,
    FinanceiroPendenciasController,
    FinanceiroClientesCondicoesController,
    CadastrosOpcoesPagamentoController,
  ],
  providers: [CadastroFinanceiroService, CondicaoPagamentoService],
  exports: [CadastroFinanceiroService, CondicaoPagamentoService],
})
export class CadastroFinanceiroModule {}
