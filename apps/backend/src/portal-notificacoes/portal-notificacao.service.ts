import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, StatusCadastroCliente, TipoNotificacaoPortal } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  mensagemCadastroAprovado,
  mensagemCadastroEmAnalise,
  mensagemCadastroRejeitado,
  mensagemCondicaoAlterada,
  mensagemUnidadeProcessoAberto,
  mensagemUnidadeProcessoEncerrado,
  type MensagemPortalNotificacao,
} from './portal-notificacao-mensagens';

type Db = Prisma.TransactionClient | PrismaService;

export type PortalNotificacaoPublica = {
  id: string;
  tipo: TipoNotificacaoPortal;
  titulo: string;
  corpo: string;
  link: string | null;
  lidaEm: Date | null;
  createdAt: Date;
};

@Injectable()
export class PortalNotificacaoService {
  private readonly logger = new Logger(PortalNotificacaoService.name);

  constructor(private readonly prisma: PrismaService) {}

  async criarCadastroEmAnalise(
    input: { clienteId: string; tenantId: string },
    db: Db = this.prisma,
  ) {
    return this.criar(input, mensagemCadastroEmAnalise(), db);
  }

  async criarCadastroAprovado(
    input: { clienteId: string; tenantId: string; forma: string | null; prazo: string | null },
    db: Db = this.prisma,
  ) {
    return this.criar(input, mensagemCadastroAprovado(input.forma, input.prazo), db);
  }

  async criarCadastroRejeitado(
    input: { clienteId: string; tenantId: string; motivo: string },
    db: Db = this.prisma,
  ) {
    return this.criar(input, mensagemCadastroRejeitado(input.motivo), db);
  }

  async criarCondicaoAlterada(
    input: { clienteId: string; tenantId: string; forma: string | null; prazo: string | null },
    db: Db = this.prisma,
  ) {
    return this.criar(input, mensagemCondicaoAlterada(input.forma, input.prazo), db);
  }

  async criarUnidadeProcesso(
    input: {
      clienteId: string;
      tenantId: string;
      numero: number;
      unidadeIso: string;
      aberto: boolean;
    },
    db: Db = this.prisma,
  ) {
    const msg = input.aberto
      ? mensagemUnidadeProcessoAberto(input.numero, input.unidadeIso)
      : mensagemUnidadeProcessoEncerrado(input.numero, input.unidadeIso);
    return this.criar(input, msg, db);
  }

  async listar(clienteId: string): Promise<PortalNotificacaoPublica[]> {
    await this.ensureCadastroEmAnaliseSePendente(clienteId);
    const rows = await this.prisma.portalNotificacao.findMany({
      where: { clienteId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        tipo: true,
        titulo: true,
        corpo: true,
        link: true,
        lidaEm: true,
        createdAt: true,
      },
    });
    return rows;
  }

  async contarNaoLidas(clienteId: string): Promise<{ count: number }> {
    await this.ensureCadastroEmAnaliseSePendente(clienteId);
    const count = await this.prisma.portalNotificacao.count({
      where: { clienteId, lidaEm: null },
    });
    return { count };
  }

  async marcarLida(id: string, clienteId: string): Promise<PortalNotificacaoPublica> {
    const row = await this.prisma.portalNotificacao.findFirst({
      where: { id, clienteId },
      select: { id: true, lidaEm: true },
    });
    if (!row) throw new NotFoundException('Notificação não encontrada.');
    if (row.lidaEm) {
      const atual = await this.prisma.portalNotificacao.findFirst({
        where: { id, clienteId },
        select: {
          id: true,
          tipo: true,
          titulo: true,
          corpo: true,
          link: true,
          lidaEm: true,
          createdAt: true,
        },
      });
      if (!atual) throw new NotFoundException('Notificação não encontrada.');
      return atual;
    }
    return this.prisma.portalNotificacao.update({
      where: { id },
      data: { lidaEm: new Date() },
      select: {
        id: true,
        tipo: true,
        titulo: true,
        corpo: true,
        link: true,
        lidaEm: true,
        createdAt: true,
      },
    });
  }

  async marcarTodasLidas(clienteId: string): Promise<{ atualizadas: number }> {
    const res = await this.prisma.portalNotificacao.updateMany({
      where: { clienteId, lidaEm: null },
      data: { lidaEm: new Date() },
    });
    return { atualizadas: res.count };
  }

  private async criar(
    input: { clienteId: string; tenantId: string },
    msg: MensagemPortalNotificacao,
    db: Db,
  ) {
    return db.portalNotificacao.create({
      data: {
        clienteId: input.clienteId,
        tenantId: input.tenantId,
        tipo: msg.tipo,
        titulo: msg.titulo,
        corpo: msg.corpo,
        link: msg.link,
      },
    });
  }

  /** Cadastros pendentes anteriores à inbox recebem o aviso inicial uma vez. */
  private async ensureCadastroEmAnaliseSePendente(clienteId: string): Promise<void> {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, deletedAt: null },
      select: { id: true, tenantId: true, statusCadastro: true },
    });
    if (!cliente || cliente.statusCadastro !== StatusCadastroCliente.PENDENTE_ANALISE_FINANCEIRA) {
      return;
    }
    const jaExiste = await this.prisma.portalNotificacao.findFirst({
      where: { clienteId, tipo: TipoNotificacaoPortal.CADASTRO_EM_ANALISE },
      select: { id: true },
    });
    if (jaExiste) return;
    try {
      await this.criarCadastroEmAnalise({ clienteId: cliente.id, tenantId: cliente.tenantId });
    } catch (e) {
      this.logger.warn(
        `Falha ao registrar aviso de cadastro em análise: ${e instanceof Error ? e.message : e}`,
      );
    }
  }
}
