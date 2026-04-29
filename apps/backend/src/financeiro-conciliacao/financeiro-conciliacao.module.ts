import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FinanceiroConciliacaoController } from './financeiro-conciliacao.controller';
import { FinanceiroConciliacaoService } from './financeiro-conciliacao.service';
import { ExtratoStoreService } from './extrato-store.service';

@Module({
  imports: [PrismaModule],
  controllers: [FinanceiroConciliacaoController],
  providers: [FinanceiroConciliacaoService, ExtratoStoreService],
})
export class FinanceiroConciliacaoModule {}
