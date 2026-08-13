import { Global, Module } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { PasswordPolicyService } from './password-policy.service';

@Global()
@Module({
  imports: [TenantModule],
  providers: [PasswordPolicyService],
  exports: [PasswordPolicyService],
})
export class PasswordPolicyModule {}
