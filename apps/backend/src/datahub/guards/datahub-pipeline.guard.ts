import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { isGerenteDatahubTi } from '../../common/constants/role-permissions';

/**
 * Pipeline Lake/ETL/Quality-verify: ADMIN sempre; GERENTE só se e-mail estiver em DATAHUB_TI_EMAILS.
 * Simula papel TI/Dados sem novo enum Role (sem migration nesta fase).
 */
@Injectable()
export class DatahubPipelineGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user: AuthUser }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('Não autenticado');
    if (user.role === Role.ADMIN) return true;
    if (user.role !== Role.GERENTE) {
      throw new ForbiddenException('Pipeline Datahub restrito a ADMIN ou GERENTE TI.');
    }
    const raw = this.config.get<string>('DATAHUB_TI_EMAILS') ?? '';
    if (isGerenteDatahubTi(user.email, raw)) return true;
    throw new ForbiddenException(
      'Conta GERENTE precisa constar em DATAHUB_TI_EMAILS para operações de pipeline.',
    );
  }
}

