import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagService } from './feature-flag.service';
import { featureFlagEvalContextFromRequest } from './feature-flag-eval-context.util';
import { REQUIRE_FEATURE_FLAG_KEY } from './require-feature-flag.decorator';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly flags: FeatureFlagService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const chave =
      this.reflector.get<string>(REQUIRE_FEATURE_FLAG_KEY, context.getHandler()) ??
      this.reflector.get<string>(REQUIRE_FEATURE_FLAG_KEY, context.getClass());
    if (!chave) return true;

    const req = context.switchToHttp().getRequest();
    const ctx = featureFlagEvalContextFromRequest(req as Parameters<typeof featureFlagEvalContextFromRequest>[0]);
    const enabled = await this.flags.isEnabled(chave, ctx);
    if (!enabled) {
      throw new ServiceUnavailableException(
        `Funcionalidade indisponível (${chave}). Modo contingência ou rollout parcial ativo.`,
      );
    }
    return true;
  }
}
