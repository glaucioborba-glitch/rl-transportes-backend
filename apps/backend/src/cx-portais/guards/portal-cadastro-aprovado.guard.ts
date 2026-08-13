import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { StatusCadastroCliente } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CxPortalRequestUser } from '../types/cx-portal.types';

/** Bloqueia mutações operacionais enquanto cadastro aguarda análise financeira. */
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
    if (cliente.statusCadastro === StatusCadastroCliente.APROVADO) return true;

    if (cliente.statusCadastro === StatusCadastroCliente.REJEITADO) {
      throw new ForbiddenException('Cadastro rejeitado pela análise financeira.');
    }

    throw new ForbiddenException(
      'Cadastro pendente de análise financeira. Você pode visualizar informações, mas não criar solicitações.',
    );
  }
}
