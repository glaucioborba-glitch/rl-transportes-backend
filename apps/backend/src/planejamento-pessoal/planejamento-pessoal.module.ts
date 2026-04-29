import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlanejamentoPessoalController } from './planejamento-pessoal.controller';
import { PlanejamentoPessoalService } from './planejamento-pessoal.service';

@Module({
  imports: [PrismaModule],
  controllers: [PlanejamentoPessoalController],
  providers: [PlanejamentoPessoalService],
})
export class PlanejamentoPessoalModule {}
