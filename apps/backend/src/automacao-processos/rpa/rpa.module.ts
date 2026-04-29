import { Module } from '@nestjs/common';
import { AutomacaoSharedModule } from '../automacao-shared.module';
import { RpaAutomacaoService } from './rpa-automacao.service';
import { RpaAutomacaoController } from './rpa-automacao.controller';

@Module({
  imports: [AutomacaoSharedModule],
  providers: [RpaAutomacaoService],
  controllers: [RpaAutomacaoController],
})
export class RPAModule {}
