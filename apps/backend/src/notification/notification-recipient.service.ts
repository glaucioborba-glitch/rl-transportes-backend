import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeWhatsappPhone } from './whatsapp-phone.util';

export type OperacionalRecipient = {
  telefoneE164: string;
  nome: string;
  protocolo: string;
  containerIso: string;
};

export type FinanceiroRecipient = {
  telefoneE164: string;
  nome: string;
};

@Injectable()
export class NotificationRecipientService {
  constructor(private readonly prisma: PrismaService) {}

  /** Telefone do solicitante (contato da solicitação no portal). */
  async resolveOperacionalBySolicitacao(solicitacaoId: string): Promise<OperacionalRecipient | null> {
    const sol = await this.prisma.solicitacao.findFirst({
      where: { id: solicitacaoId, deletedAt: null },
      include: {
        solicitanteContato: true,
        containersSolicitacao: { orderBy: { ordem: 'asc' }, take: 1 },
        unidades: { take: 1 },
      },
    });
    if (!sol) return null;

    const phoneRaw =
      sol.solicitanteContato?.telefone ??
      (await this.resolvePessoaAutorizadaPhone(sol.clienteId));
    const telefoneE164 = normalizeWhatsappPhone(phoneRaw);
    if (!telefoneE164) return null;

    const containerIso =
      sol.containersSolicitacao[0]?.unidade?.trim() ||
      sol.unidades[0]?.numeroIso?.trim() ||
      '';

    return {
      telefoneE164,
      nome: sol.solicitanteContato?.nome?.trim() || 'Cliente',
      protocolo: sol.protocolo,
      containerIso,
    };
  }

  /** Telefone financeiro: responsável do tenant ou titular ADMIN_CLIENTE. */
  async resolveFinanceiroByCliente(clienteId: string): Promise<FinanceiroRecipient | null> {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, deletedAt: null },
      include: { usuarioPortal: true },
    });
    if (!cliente) return null;

    const admin = await this.prisma.user.findFirst({
      where: { clienteId, role: Role.ADMIN_CLIENTE },
      select: { email: true },
    });

    const phoneRaw =
      cliente.responsavelTelefone?.trim() ||
      cliente.telefone?.trim() ||
      (await this.resolvePessoaAutorizadaPhone(clienteId));
    const telefoneE164 = normalizeWhatsappPhone(phoneRaw);
    if (!telefoneE164) return null;

    const nome =
      cliente.responsavel?.trim() ||
      cliente.nomeFantasia?.trim() ||
      cliente.razaoSocial?.trim() ||
      admin?.email?.split('@')[0] ||
      'Cliente';

    return { telefoneE164, nome };
  }

  private async resolvePessoaAutorizadaPhone(clienteId: string): Promise<string | null> {
    const pessoa = await this.prisma.pessoaAutorizada.findFirst({
      where: { clienteId, telefone: { not: null } },
      orderBy: { createdAt: 'asc' },
      select: { telefone: true },
    });
    return pessoa?.telefone ?? null;
  }
}
