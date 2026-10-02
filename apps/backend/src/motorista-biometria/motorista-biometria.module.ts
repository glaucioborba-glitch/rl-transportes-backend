import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MotoristaBiometriaController } from './motorista-biometria.controller';
import { MotoristaBiometriaService } from './motorista-biometria.service';

@Module({
  imports: [PrismaModule],
  controllers: [MotoristaBiometriaController],
  providers: [MotoristaBiometriaService],
  exports: [MotoristaBiometriaService],
})
export class MotoristaBiometriaModule {}
