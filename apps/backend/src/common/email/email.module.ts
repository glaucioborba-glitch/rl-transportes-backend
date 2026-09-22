import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { TenantAvisosService } from './tenant-avisos.service';

@Module({
  imports: [ConfigModule],
  providers: [EmailService, TenantAvisosService],
  exports: [EmailService, TenantAvisosService],
})
export class EmailModule {}
