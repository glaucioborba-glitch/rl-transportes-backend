import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FeatureFlagsController } from './feature-flags.controller';
import { FeatureFlagGuard } from './feature-flag.guard';
import { FeatureFlagService } from './feature-flag.service';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [FeatureFlagsController],
  providers: [FeatureFlagService, FeatureFlagGuard],
  exports: [FeatureFlagService, FeatureFlagGuard],
})
export class FeatureFlagsModule {}
