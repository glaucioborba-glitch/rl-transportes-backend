import { Global, Module } from '@nestjs/common';
import { TenantContextModule } from './tenant-context.module';
import { IntegrationCredentialsService } from './integration-credentials.service';

@Global()
@Module({
  imports: [TenantContextModule],
  providers: [IntegrationCredentialsService],
  exports: [IntegrationCredentialsService],
})
export class IntegrationCredentialsModule {}
