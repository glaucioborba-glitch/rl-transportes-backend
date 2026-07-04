import { Module } from '@nestjs/common';
import { CadastroFinanceiroController } from './cadastro-financeiro.controller';
import { FinanceiroPendenciasController } from './financeiro-pendencias.controller';
import { CadastroFinanceiroService } from './cadastro-financeiro.service';

@Module({
  controllers: [CadastroFinanceiroController, FinanceiroPendenciasController],
  providers: [CadastroFinanceiroService],
  exports: [CadastroFinanceiroService],
})
export class CadastroFinanceiroModule {}
