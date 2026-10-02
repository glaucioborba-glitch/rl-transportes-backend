import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CatalogoMotoristasExternosController } from './catalogo-motoristas-externos.controller';
import { CatalogoMotoristasExternosService } from './catalogo-motoristas-externos.service';

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  controllers: [CatalogoMotoristasExternosController],
  providers: [CatalogoMotoristasExternosService],
  exports: [CatalogoMotoristasExternosService],
})
export class CatalogoMotoristasExternosModule {}
