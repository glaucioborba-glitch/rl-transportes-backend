import { Module } from '@nestjs/common';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SuperAdminController } from './super-admin.controller';

@Module({
  imports: [PrismaModule, FeatureFlagsModule],
  controllers: [SuperAdminController],
})
export class SuperAdminModule {}
