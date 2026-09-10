import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { FretesController } from './fretes.controller';
import { FretesService } from './fretes.service';

@Module({
  imports: [PrismaModule, AuthModule, AuditoriaModule],
  controllers: [FretesController],
  providers: [FretesService],
  exports: [FretesService],
})
export class FretesModule {}
