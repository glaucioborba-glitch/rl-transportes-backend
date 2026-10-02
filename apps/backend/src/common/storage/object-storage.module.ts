import { Module, Global } from '@nestjs/common';
import { IntegrationCredentialsModule } from '../../tenant/integration-credentials.module';
import { ObjectStorageService } from './object-storage.service';

@Global()
@Module({
  imports: [IntegrationCredentialsModule],
  providers: [ObjectStorageService],
  exports: [ObjectStorageService],
})
export class ObjectStorageModule {}
