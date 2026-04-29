import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlanejamentoEstrategicoController } from './planejamento-estrategico.controller';
import { PlanejamentoEstrategicoService } from './planejamento-estrategico.service';

@Module({
  imports: [PrismaModule],
  controllers: [PlanejamentoEstrategicoController],
  providers: [PlanejamentoEstrategicoService],
  exports: [PlanejamentoEstrategicoService],
})
export class PlanejamentoEstrategicoModule {}
