import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  ModalidadeUnidadeProcesso,
  Prisma,
  StatusAluguel,
  StatusSolicitacaoAluguel,
  StatusUnidadeAluguel,
  StatusUnidadeProcesso,
} from '@prisma/client';
import { ArmazenagemBillingService } from '../armazenagem-faturamento/armazenagem-billing.service';
import { CadastrosTabelasAluguelService } from '../cadastros/cadastros-tabelas-aluguel.service';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { formatUnidadeProcessoId } from '../unidade-processo/unidade-direcao.util';
import {
  aluguelTemDiaria,
  containerContextFromAluguel,
  matchAluguelItem,
  type AluguelItemLike,
} from './aluguel-pricing.util';
import { IniciarAluguelDto } from './dto/aluguel.dto';

type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class AluguelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: ArmazenagemBillingService,
    private readonly tabelas: CadastrosTabelasAluguelService,
    private readonly outbox: OutboxService,
  ) {}

  async list(status?: string) {
    const rows = await this.prisma.aluguel.findMany({
      where: status && status !== 'todos' ? { status: status as StatusAluguel } : {},
      include: {
        unidadeAluguel: true,
        cliente: { select: { id: true, razaoSocial: true } },
        tabelaAluguel: { select: { id: true, nome: true } },
        unidadeProcesso: { select: { id: true, numero: true, status: true, entradaEm: true, saidaEm: true } },
      },
      orderBy: { iniciadoEm: 'desc' },
      take: 200,
    });
    return { items: rows.map((r) => this.toContratoShape(r)), total: rows.length };
  }

  async listFrota() {
    const rows = await this.prisma.cadastroUnidadeAluguel.findMany({
      where: { deletedAt: null, status: { not: StatusUnidadeAluguel.INATIVA } },
      include: {
        alugueis: {
          where: { status: StatusAluguel.ATIVO },
          take: 1,
          include: {
            cliente: { select: { razaoSocial: true } },
            unidadeProcesso: { select: { id: true, numero: true } },
          },
        },
      },
      orderBy: { unidadeIso: 'asc' },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        unidadeIso: r.unidadeIso,
        tipoContainerCodigo: r.tipoContainerCodigo,
        containerTamanho: r.containerTamanho,
        status: r.status,
        aluguelAtivo: r.alugueis[0]
          ? {
              id: r.alugueis[0].id,
              clienteNome: r.alugueis[0].cliente.razaoSocial,
              unidadeProcessoId: r.alugueis[0].unidadeProcesso.id,
              numero: r.alugueis[0].unidadeProcesso.numero,
            }
          : null,
      })),
      total: rows.length,
    };
  }

  async listClientes() {
    const rows = await this.prisma.cliente.findMany({
      where: { deletedAt: null },
      select: { id: true, razaoSocial: true, nomeFantasia: true },
      orderBy: { razaoSocial: 'asc' },
      take: 400,
    });
    return { items: rows };
  }

  async iniciar(dto: IniciarAluguelDto, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const unidade = await tx.cadastroUnidadeAluguel.findFirst({
        where: { id: dto.unidadeAluguelId, deletedAt: null },
      });
      if (!unidade) throw new NotFoundException('Unidade de aluguel não encontrada.');
      if (unidade.status !== StatusUnidadeAluguel.DISPONIVEL) {
        throw new BadRequestException(
          unidade.status === StatusUnidadeAluguel.USO_PROPRIO
            ? `A unidade ${unidade.unidadeIso} está em uso próprio e não pode ser alugada.`
            : `A unidade ${unidade.unidadeIso} não está disponível.`,
        );
      }

      const aberto = await tx.unidadeProcesso.findFirst({
        where: {
          unidadeIso: unidade.unidadeIso,
          status: StatusUnidadeProcesso.ABERTO,
          modalidade: ModalidadeUnidadeProcesso.ALUGUEL,
        },
      });
      if (aberto) {
        throw new ConflictException(
          `A unidade ${unidade.unidadeIso} já tem ${formatUnidadeProcessoId(aberto.numero)} de aluguel aberto.`,
        );
      }

      let clienteId = dto.clienteId;
      let solicitacaoAluguelId: string | null = null;
      if (dto.solicitacaoAluguelId) {
        const reserva = await tx.solicitacaoAluguel.findFirst({
          where: { id: dto.solicitacaoAluguelId },
        });
        if (!reserva) throw new NotFoundException('Reserva de aluguel não encontrada.');
        if (reserva.status !== StatusSolicitacaoAluguel.APROVADO) {
          throw new BadRequestException('Esta reserva não está aguardando início.');
        }
        const jaIniciados = await tx.aluguel.count({
          where: { solicitacaoAluguelId: reserva.id },
        });
        if (jaIniciados >= reserva.quantidade) {
          throw new BadRequestException('Todas as unidades desta reserva já foram iniciadas.');
        }
        clienteId = reserva.clienteId;
        solicitacaoAluguelId = reserva.id;
      }

      const cliente = await tx.cliente.findFirst({
        where: { id: clienteId, deletedAt: null },
        select: { id: true, tenantId: true, razaoSocial: true, cadastroTabelaAluguelId: true },
      });
      if (!cliente) throw new NotFoundException('Cliente não encontrado.');

      const tabela = dto.tabelaAluguelId
        ? await tx.cadastroTabelaAluguel.findFirst({
            where: { id: dto.tabelaAluguelId, deletedAt: null, ativo: true },
            include: { itens: { where: { deletedAt: null, ativo: true } } },
          })
        : cliente.cadastroTabelaAluguelId
          ? await tx.cadastroTabelaAluguel.findFirst({
              where: { id: cliente.cadastroTabelaAluguelId, deletedAt: null, ativo: true },
              include: { itens: { where: { deletedAt: null, ativo: true } } },
            })
          : await this.tabelas.resolveTabelaVigente(cliente.tenantId);
      if (!tabela) {
        throw new UnprocessableEntityException(
          'Não há tabela de aluguel vigente. Cadastre em Financeiro → Aluguel.',
        );
      }

      const item = matchAluguelItem(
        tabela.itens.map((i) => this.toItemLike(i)),
        unidade.tipoContainerCodigo,
        unidade.containerTamanho,
      );
      if (!item || !aluguelTemDiaria(item)) {
        throw new UnprocessableEntityException(
          `Tabela de aluguel sem diária para ${unidade.tipoContainerCodigo} ${unidade.containerTamanho}.`,
        );
      }

      const now = new Date();
      const rows = await tx.$queryRaw<Array<{ n: bigint | number }>>`
        SELECT nextval('unidade_processos_numero_seq') AS n
      `;
      const numero = Number(rows[0]?.n ?? 0);
      const processo = await tx.unidadeProcesso.create({
        data: {
          tenantId: cliente.tenantId,
          numero,
          unidadeIso: unidade.unidadeIso,
          clienteId: cliente.id,
          status: StatusUnidadeProcesso.ABERTO,
          modalidade: ModalidadeUnidadeProcesso.ALUGUEL,
          entradaEm: now,
        },
      });

      const aluguel = await tx.aluguel.create({
        data: {
          tenantId: cliente.tenantId,
          unidadeAluguelId: unidade.id,
          clienteId: cliente.id,
          tabelaAluguelId: tabela.id,
          unidadeProcessoId: processo.id,
          status: StatusAluguel.ATIVO,
          iniciadoEm: now,
          observacao: dto.observacao?.trim() || null,
          solicitacaoAluguelId,
        },
      });

      if (solicitacaoAluguelId) {
        const iniciados = await tx.aluguel.count({ where: { solicitacaoAluguelId } });
        const qtd = await tx.solicitacaoAluguel.findFirst({
          where: { id: solicitacaoAluguelId },
          select: { quantidade: true },
        });
        if (qtd && iniciados >= qtd.quantidade) {
          await tx.solicitacaoAluguel.update({
            where: { id: solicitacaoAluguelId },
            data: { status: StatusSolicitacaoAluguel.INICIADO },
          });
        }
      }

      await tx.cadastroUnidadeAluguel.update({
        where: { id: unidade.id },
        data: { status: StatusUnidadeAluguel.ALUGADA },
      });

      await this.billing.openPreFaturasForAluguel(
        {
          unidadeProcessoId: processo.id,
          clienteId: cliente.id,
          tenantId: cliente.tenantId,
          unidadeIso: unidade.unidadeIso,
          iniciadoEm: now,
          tipoContainerCodigo: unidade.tipoContainerCodigo,
          containerTamanho: unidade.containerTamanho,
          item,
        },
        tx,
      );

      await this.outbox.enqueue(tx, {
        aggregateType: 'UnidadeProcesso',
        aggregateId: processo.id,
        eventType: 'UNIDADE_PROCESSO_ABERTO',
        payload: {
          unidadeProcessoId: processo.id,
          numero: processo.numero,
          unidadeIso: unidade.unidadeIso,
          clienteId: cliente.id,
          tenantId: cliente.tenantId,
          modalidade: 'ALUGUEL',
          aluguelId: aluguel.id,
          actorUserId,
        },
      });

      return {
        id: aluguel.id,
        numero: processo.numero,
        unidadeProcessoId: processo.id,
        unidadeIso: unidade.unidadeIso,
        clienteNome: cliente.razaoSocial,
        iniciadoEm: now.toISOString(),
      };
    });
  }

  async devolver(id: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const aluguel = await tx.aluguel.findUnique({
        where: { id },
        include: {
          unidadeAluguel: true,
          unidadeProcesso: true,
          tabelaAluguel: { include: { itens: { where: { deletedAt: null, ativo: true } } } },
        },
      });
      if (!aluguel) throw new NotFoundException('Aluguel não encontrado.');
      if (aluguel.status !== StatusAluguel.ATIVO) {
        throw new BadRequestException('Este aluguel já foi encerrado.');
      }

      const hospedada = await tx.unidadeProcesso.findFirst({
        where: {
          unidadeIso: aluguel.unidadeAluguel.unidadeIso,
          status: StatusUnidadeProcesso.ABERTO,
          modalidade: ModalidadeUnidadeProcesso.PATIO,
        },
        select: { numero: true },
      });
      if (hospedada) {
        throw new BadRequestException(
          `A unidade está no pátio (${formatUnidadeProcessoId(hospedada.numero)}). Faça a saída do estoque antes de encerrar o aluguel.`,
        );
      }

      const item = matchAluguelItem(
        aluguel.tabelaAluguel.itens.map((i) => this.toItemLike(i)),
        aluguel.unidadeAluguel.tipoContainerCodigo,
        aluguel.unidadeAluguel.containerTamanho,
      );
      if (!item) {
        throw new UnprocessableEntityException(
          'Item da tabela de aluguel não encontrado para encerrar a cobrança.',
        );
      }

      const now = new Date();
      await tx.unidadeProcesso.update({
        where: { id: aluguel.unidadeProcessoId },
        data: { status: StatusUnidadeProcesso.ENCERRADO, saidaEm: now },
      });
      await tx.aluguel.update({
        where: { id },
        data: { status: StatusAluguel.ENCERRADO, encerradoEm: now },
      });
      await tx.cadastroUnidadeAluguel.update({
        where: { id: aluguel.unidadeAluguelId },
        data: { status: StatusUnidadeAluguel.DISPONIVEL },
      });

      if (aluguel.solicitacaoAluguelId) {
        const aindaAtivos = await tx.aluguel.count({
          where: {
            solicitacaoAluguelId: aluguel.solicitacaoAluguelId,
            status: StatusAluguel.ATIVO,
            id: { not: id },
          },
        });
        if (aindaAtivos === 0) {
          await tx.solicitacaoAluguel.update({
            where: { id: aluguel.solicitacaoAluguelId },
            data: { status: StatusSolicitacaoAluguel.ENCERRADO },
          });
        }
      }

      await this.billing.consolidateAluguel(
        {
          unidadeProcessoId: aluguel.unidadeProcessoId,
          clienteId: aluguel.clienteId,
          tenantId: aluguel.tenantId,
          unidadeIso: aluguel.unidadeAluguel.unidadeIso,
          iniciadoEm: aluguel.iniciadoEm,
          encerradoEm: now,
          tipoContainerCodigo: aluguel.unidadeAluguel.tipoContainerCodigo,
          containerTamanho: aluguel.unidadeAluguel.containerTamanho,
          item,
        },
        tx,
      );

      await this.outbox.enqueue(tx, {
        aggregateType: 'UnidadeProcesso',
        aggregateId: aluguel.unidadeProcessoId,
        eventType: 'UNIDADE_PROCESSO_ENCERRADO',
        payload: {
          unidadeProcessoId: aluguel.unidadeProcessoId,
          numero: aluguel.unidadeProcesso.numero,
          unidadeIso: aluguel.unidadeAluguel.unidadeIso,
          clienteId: aluguel.clienteId,
          tenantId: aluguel.tenantId,
          modalidade: 'ALUGUEL',
          aluguelId: aluguel.id,
          actorUserId,
        },
      });

      return {
        id: aluguel.id,
        numero: aluguel.unidadeProcesso.numero,
        encerradoEm: now.toISOString(),
      };
    });
  }

  async loadItemForProcesso(unidadeProcessoId: string, db: Db = this.prisma) {
    const aluguel = await db.aluguel.findUnique({
      where: { unidadeProcessoId },
      include: {
        unidadeAluguel: true,
        tabelaAluguel: { include: { itens: { where: { deletedAt: null, ativo: true } } } },
      },
    });
    if (!aluguel) return null;
    const item = matchAluguelItem(
      aluguel.tabelaAluguel.itens.map((i) => this.toItemLike(i)),
      aluguel.unidadeAluguel.tipoContainerCodigo,
      aluguel.unidadeAluguel.containerTamanho,
    );
    if (!item) return null;
    return {
      aluguel,
      item,
      container: containerContextFromAluguel(aluguel.unidadeAluguel),
    };
  }

  private toItemLike(row: {
    tipoContainerCodigo: string;
    containerTamanho: string;
    valorDiaria: Prisma.Decimal | number;
    diasFreeTime: number;
    valorHandling: Prisma.Decimal | number;
    faixasDiaria?: unknown;
    ativo: boolean;
  }): AluguelItemLike {
    return {
      tipoContainerCodigo: row.tipoContainerCodigo,
      containerTamanho: row.containerTamanho,
      valorDiaria: Number(row.valorDiaria),
      diasFreeTime: row.diasFreeTime,
      valorHandling: Number(row.valorHandling),
      faixasDiaria: row.faixasDiaria,
      ativo: row.ativo,
    };
  }

  private toContratoShape(row: {
    id: string;
    status: StatusAluguel;
    iniciadoEm: Date;
    encerradoEm: Date | null;
    observacao: string | null;
    unidadeAluguel: { unidadeIso: string; tipoContainerCodigo: string; containerTamanho: string };
    cliente: { id: string; razaoSocial: string };
    tabelaAluguel: { id: string; nome: string };
    unidadeProcesso: { id: string; numero: number; status: StatusUnidadeProcesso };
  }) {
    return {
      id: row.id,
      status: row.status,
      iniciadoEm: row.iniciadoEm.toISOString(),
      encerradoEm: row.encerradoEm?.toISOString() ?? null,
      observacao: row.observacao,
      unidadeIso: row.unidadeAluguel.unidadeIso,
      tipoContainerCodigo: row.unidadeAluguel.tipoContainerCodigo,
      containerTamanho: row.unidadeAluguel.containerTamanho,
      clienteId: row.cliente.id,
      clienteNome: row.cliente.razaoSocial,
      tabelaNome: row.tabelaAluguel.nome,
      unidadeProcessoId: row.unidadeProcesso.id,
      numero: row.unidadeProcesso.numero,
      idLabel: formatUnidadeProcessoId(row.unidadeProcesso.numero),
    };
  }
}
