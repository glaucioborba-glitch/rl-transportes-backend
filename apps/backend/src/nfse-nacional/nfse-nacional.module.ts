import { Module } from '@nestjs/common';
import { IntegrationCredentialsModule } from '../tenant/integration-credentials.module';
import { NfseNacionalAdapter } from './nfse-nacional.adapter';
import { NfseNacionalService } from './nfse-nacional.service';

@Module({
  imports: [IntegrationCredentialsModule],
  providers: [NfseNacionalAdapter, NfseNacionalService],
  exports: [NfseNacionalService],
})
export class NfseNacionalModule {}
