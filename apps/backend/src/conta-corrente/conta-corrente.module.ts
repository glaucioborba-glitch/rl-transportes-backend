import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { ContaCorrenteController } from './conta-corrente.controller';
import { ContaCorrenteService } from './conta-corrente.service';

@Module({
  imports: [AuditoriaModule],
  controllers: [ContaCorrenteController],
  providers: [ContaCorrenteService],
  exports: [ContaCorrenteService],
})
export class ContaCorrenteModule {}
