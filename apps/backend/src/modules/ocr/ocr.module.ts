import { Module } from '@nestjs/common';
import { IntegrationCredentialsModule } from '../../tenant/integration-credentials.module';
import { OCRController } from './ocr.controller';
import { OCRService } from './ocr.service';

@Module({
  imports: [IntegrationCredentialsModule],
  controllers: [OCRController],
  providers: [OCRService],
  exports: [OCRService],
})
export class OCRModule {}
