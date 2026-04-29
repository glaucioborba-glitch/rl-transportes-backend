import { Module } from '@nestjs/common';
import { FolhaRhController } from './folha-rh.controller';
import { FolhaRhService } from './folha-rh.service';
import { FolhaRhStoreService } from './folha-rh-store.service';

@Module({
  controllers: [FolhaRhController],
  providers: [FolhaRhService, FolhaRhStoreService],
})
export class FolhaRhModule {}
