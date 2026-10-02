import { Module } from '@nestjs/common';
import { OutboxModule } from '../outbox/outbox.module';
import { PrismaModule } from '../prisma/prisma.module';
import { FaturaPacoteController } from './fatura-pacote.controller';
import { FaturaPacoteService } from './fatura-pacote.service';

@Module({
  imports: [PrismaModule, OutboxModule],
  controllers: [FaturaPacoteController],
  providers: [FaturaPacoteService],
  exports: [FaturaPacoteService],
})
export class FaturaPacoteModule {}
