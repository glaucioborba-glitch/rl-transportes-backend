import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {
  CatalogoNaviosController,
  CatalogoNaviosSuperAdminController,
} from './catalogo-navios.controller';
import { CatalogoNaviosService } from './catalogo-navios.service';

@Module({
  imports: [PrismaModule],
  controllers: [CatalogoNaviosController, CatalogoNaviosSuperAdminController],
  providers: [CatalogoNaviosService],
  exports: [CatalogoNaviosService],
})
export class CatalogoNaviosModule {}
