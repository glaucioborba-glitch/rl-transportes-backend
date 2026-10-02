import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {
  CatalogoContainersController,
  CatalogoContainersSuperAdminController,
} from './catalogo-containers.controller';
import { CatalogoContainersService } from './catalogo-containers.service';

@Module({
  imports: [PrismaModule],
  controllers: [CatalogoContainersController, CatalogoContainersSuperAdminController],
  providers: [CatalogoContainersService],
  exports: [CatalogoContainersService],
})
export class CatalogoContainersModule {}
