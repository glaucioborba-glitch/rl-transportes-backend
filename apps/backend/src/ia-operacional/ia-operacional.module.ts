import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IaOperacionalController } from './ia-operacional.controller';
import { IaOperacionalService } from './ia-operacional.service';

@Module({
  imports: [PrismaModule],
  controllers: [IaOperacionalController],
  providers: [IaOperacionalService],
  exports: [IaOperacionalService],
})
export class IaOperacionalModule {}
