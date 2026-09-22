import { Global, Module } from '@nestjs/common';
import { EmailModule } from '../common/email/email.module';
import { AlertService } from './alert.service';

@Global()
@Module({
  imports: [EmailModule],
  providers: [AlertService],
  exports: [AlertService],
})
export class AlertModule {}
