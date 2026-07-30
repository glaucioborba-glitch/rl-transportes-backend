import { Module } from '@nestjs/common';
import { OCRController } from './ocr.controller';
import { OCRService } from './ocr.service';

@Module({
  controllers: [OCRController],
  providers: [OCRService],
  exports: [OCRService],
})
export class OCRModule {}
