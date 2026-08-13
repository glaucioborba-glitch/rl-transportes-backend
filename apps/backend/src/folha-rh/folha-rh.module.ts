import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FolhaRhController } from './folha-rh.controller';
import { FolhaRhService } from './folha-rh.service';
import { FolhaRhStoreService } from './folha-rh-store.service';

@Module({
  imports: [PrismaModule],
  controllers: [FolhaRhController],
  providers: [FolhaRhService, FolhaRhStoreService],
})
export class FolhaRhModule {}
