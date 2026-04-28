import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ComercialPricingController } from './comercial-pricing.controller';
import { ComercialPricingService } from './comercial-pricing.service';

@Module({
  imports: [PrismaModule],
  controllers: [ComercialPricingController],
  providers: [ComercialPricingService],
  exports: [ComercialPricingService],
})
export class ComercialPricingModule {}
