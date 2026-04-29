import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TesourariaController } from './tesouraria.controller';
import { TesourariaService } from './tesouraria.service';
import { TesourariaStoreService } from './tesouraria-store.service';

@Module({
  imports: [PrismaModule],
  controllers: [TesourariaController],
  providers: [TesourariaService, TesourariaStoreService],
})
export class TesourariaModule {}
