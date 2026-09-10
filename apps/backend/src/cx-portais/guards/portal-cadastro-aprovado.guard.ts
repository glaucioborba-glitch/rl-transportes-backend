import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CxPortalRequestUser } from '../types/cx-portal.types';
import { cadastroPermiteSolicitacoes } from '../../cadastro-financeiro/cadastro-operacao-inicial';

/** Bloqueia mutações só se o cadastro foi rejeitado. Pendente opera à vista. */
@Injectable()
export class PortalCadastroAprovadoGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ method?: string; cxUser?: CxPortalRequestUser }>();
    const method = (req.method ?? 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;

    const cx = req.cxUser;
    if (!cx?.clienteId || cx.portalPapel !== 'CLIENTE') return true;

    const cliente = await this.prisma.cliente.findFirst({
      where: { id: cx.clienteId, deletedAt: null },
      select: { statusCadastro: true },
    });
    if (!cliente) return true;
    if (cadastroPermiteSolicitacoes(cliente.statusCadastro)) return true;

    throw new ForbiddenException('Cadastro rejeitado pela análise financeira.');
  }
}
