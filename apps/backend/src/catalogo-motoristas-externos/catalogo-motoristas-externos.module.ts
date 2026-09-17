import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CatalogoMotoristasExternosController } from './catalogo-motoristas-externos.controller';
import { CatalogoMotoristasExternosService } from './catalogo-motoristas-externos.service';

@Module({
  imports: [PrismaModule],
  controllers: [CatalogoMotoristasExternosController],
  providers: [CatalogoMotoristasExternosService],
  exports: [CatalogoMotoristasExternosService],
})
export class CatalogoMotoristasExternosModule {}

