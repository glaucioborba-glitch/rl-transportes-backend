import { Module } from '@nestjs/common';
import { BillingLazyController } from './billing-lazy.controller';
import { BillingLazyLoaderService } from './billing-lazy-loader.service';

/** Lazy-load de CRONs noturnos de billing — libera RAM no boot operacional. */
@Module({
  controllers: [BillingLazyController],
  providers: [BillingLazyLoaderService],
  exports: [BillingLazyLoaderService],
})
export class BillingLazyModule {}
