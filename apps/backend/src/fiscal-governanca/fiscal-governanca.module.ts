import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FiscalGovernancaController } from './fiscal-governanca.controller';
import { FiscalGovernancaService } from './fiscal-governanca.service';

@Module({
  imports: [PrismaModule],
  controllers: [FiscalGovernancaController],
  providers: [FiscalGovernancaService],
})
export class FiscalGovernancaModule {}
