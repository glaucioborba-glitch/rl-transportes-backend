import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';
import { CadastroFinanceiroController } from './cadastro-financeiro.controller';
import { FinanceiroPendenciasController } from './financeiro-pendencias.controller';
import { CadastroFinanceiroService } from './cadastro-financeiro.service';
import { CondicaoPagamentoService } from './condicao-pagamento.service';

@Module({
  imports: [PrismaModule, TenantModule],
  controllers: [CadastroFinanceiroController, FinanceiroPendenciasController],
  providers: [CadastroFinanceiroService, CondicaoPagamentoService],
  exports: [CadastroFinanceiroService, CondicaoPagamentoService],
})
export class CadastroFinanceiroModule {}
