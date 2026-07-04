import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TermosUsoService } from './termos-uso.service';

@Module({
  imports: [PrismaModule],
  providers: [TermosUsoService],
  exports: [TermosUsoService],
})
export class TermosUsoModule {}
