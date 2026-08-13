import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PESSOA_PODE_KEY } from '../decorators/pessoa-pode.decorator';
import type { CxPortalRequestUser } from '../../cx-portais/types/cx-portal.types';
import { PessoasPermissoesService } from '../../pessoas-permissoes/pessoas-permissoes.service';
import type { PessoaPermissaoKey } from '../../pessoas-permissoes/pessoa-permissoes.types';

@Injectable()
export class PessoaPermissoesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissoes: PessoasPermissoesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const keys = this.reflector.getAllAndOverride<PessoaPermissaoKey[] | undefined>(
      PESSOA_PODE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!keys?.length) return true;

    const req = context.switchToHttp().getRequest<Request & { cxUser?: CxPortalRequestUser }>();
    const cx = req.cxUser;
    if (!cx) throw new ForbiddenException('Seu perfil não possui permissão para executar esta ação.');

    const permissoes = await this.permissoes.assertPermissao(cx, keys, req);
    cx.permissoesPessoa = permissoes;
    return true;
  }
}
