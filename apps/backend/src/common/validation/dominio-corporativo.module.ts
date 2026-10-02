import { Module } from '@nestjs/common';
import { DominioCorporativoValidatorService } from './dominio-corporativo-validator.service';

@Module({
  providers: [DominioCorporativoValidatorService],
  exports: [DominioCorporativoValidatorService],
})
export class DominioCorporativoModule {}
