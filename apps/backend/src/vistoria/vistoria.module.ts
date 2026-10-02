import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VistoriaStorageService } from './vistoria-storage.service';
import { VistoriaService } from './vistoria.service';

@Module({
  imports: [PrismaModule],
  providers: [VistoriaStorageService, VistoriaService],
  exports: [VistoriaService, VistoriaStorageService],
})
export class VistoriaModule {}
