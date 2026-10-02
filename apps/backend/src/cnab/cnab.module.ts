import { Module } from '@nestjs/common';
import { HoldReleaseModule } from '../hold-release/hold-release.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CnabController } from './cnab.controller';
import { CnabParserService } from './cnab-parser.service';
import { CnabService } from './cnab.service';
import { ConciliacaoService } from './conciliacao.service';

@Module({
  imports: [PrismaModule, HoldReleaseModule],
  controllers: [CnabController],
  providers: [CnabService, CnabParserService, ConciliacaoService],
  exports: [CnabService, ConciliacaoService, CnabParserService],
})
export class CnabModule {}
