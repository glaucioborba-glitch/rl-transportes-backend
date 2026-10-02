import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AcaoAuditoria,
  MotivoLancamentoContaCorrente,
  Prisma,
  StatusPixCreditoComprovante,
  TipoLancamentoContaCorrente,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { ObjectStorageService } from '../common/storage/object-storage.service';
import { PortalNotificacaoService } from '../portal-notificacoes/portal-notificacao.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ContaCorrenteQueryDto } from './dto/conta-corrente-query.dto';
import type {
  CompensarContaCorrenteDto,
  CriarLancamentoContaCorrenteDto,
} from './dto/criar-lancamento-conta-corrente.dto';
import {
  DecisaoPixCreditoComprovante,
  type DecidirPixCreditoComprovanteDto,
} from './dto/decidir-pix-credito-comprovante.dto';
import {
  ANEXO_LANCAMENTO_MAX,
  ANEXO_LANCAMENTO_MIMES,
  MOTIVO_CONTA_CORRENTE_LABEL,
  classificarSaldo,
  ordenarContasCorrente,
  rotuloSaldo,
  toMoneyNumber,
  valorSinalLancamento,
} from './conta-corrente.util';

const CLIENTE_SELECT = {
  id: true,
  razaoSocial: true,
  nomeFantasia: true,
  cpfCnpj: true,
  tenantId: true,
  deletedAt: true,
} as const;

@Injectable()
export class ContaCorrenteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly storage: ObjectStorageService,
    private readonly notificacoes: PortalNotificacaoService,
  ) {}

  async listar(query: ContaCorrenteQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.ClienteWhereInput = { deletedAt: null };
    if (search) {
      const digits = search.replace(/\D/g, '');
      const or: Prisma.ClienteWhereInput[] = [
        { razaoSocial: { contains: search, mode: 'insensitive' } },
        { nomeFantasia: { contains: search, mode: 'insensitive' } },
      ];
      if (digits.length >= 3) or.push({ cpfCnpj: { contains: digits } });
      where.OR = or;
    }

    const clientes = await this.prisma.cliente.findMany({
      where,
      select: CLIENTE_SELECT,
      orderBy: { razaoSocial: 'asc' },
      take: 200,
    });
    const ids = clientes.map((c) => c.id);
    const somas =
      ids.length === 0
        ? []
        : await this.prisma.clienteContaCorrenteLancamento.groupBy({
            by: ['clienteId'],
            where: { clienteId: { in: ids } },
            _sum: { valorSinal: true },
            _count: { _all: true },
          });
    const porCliente = new Map(
      somas.map((s) => [
        s.clienteId,
        { saldo: toMoneyNumber(s._sum.valorSinal), lancamentos: s._count._all },
      ]),
    );
    const pendentes =
      ids.length === 0
        ? []
        : await this.prisma.clientePixCreditoComprovante.groupBy({
            by: ['clienteId'],
            where: { clienteId: { in: ids }, status: StatusPixCreditoComprovante.PENDENTE },
            _count: { _all: true },
          });
    const pendentesPorCliente = new Map(pendentes.map((p) => [p.clienteId, p._count._all]));

    const items = ordenarContasCorrente(
      clientes
        .map((c) => {
          const agg = porCliente.get(c.id) ?? { saldo: 0, lancamentos: 0 };
          return this.toClienteResumo(c, agg.saldo, agg.lancamentos, pendentesPorCliente.get(c.id) ?? 0);
        })
        .filter(
          (row) =>
            !query.somenteComSaldo || row.situacao !== 'ZERADO' || row.comprovantesPendentes > 0,
        ),
    );

    return { items };
  }

  async contarPendencias() {
    const count = await this.prisma.clientePixCreditoComprovante.count({
      where: { status: StatusPixCreditoComprovante.PENDENTE },
    });
    return { count };
  }

  async obter(clienteId: string) {
    const cliente = await this.carregarCliente(clienteId);
    const lancamentos = await this.prisma.clienteContaCorrenteLancamento.findMany({
      where: { clienteId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const saldo = toMoneyNumber(
      lancamentos.reduce((acc, l) => acc + toMoneyNumber(l.valorSinal), 0),
    );
    const comprovantes = await this.prisma.clientePixCreditoComprovante.findMany({
      where: { clienteId, status: StatusPixCreditoComprovante.PENDENTE },
      orderBy: { createdAt: 'desc' },
    });
    return {
      cliente: this.toClienteResumo(cliente, saldo, lancamentos.length, comprovantes.length),
      comprovantesPendentes: comprovantes.map((c) => this.toComprovante(c)),
      lancamentos: lancamentos.map((l) => this.toLancamento(l)),
    };
  }

  async baixarComprovante(clienteId: string, comprovanteId: string) {
    const row = await this.prisma.clientePixCreditoComprovante.findFirst({
      where: { id: comprovanteId, clienteId },
    });
    if (!row) throw new NotFoundException('Comprovante não encontrado.');
    const stored = await this.storage.getBuffer(row.storageKey);
    return {
      buffer: stored.buffer,
      mimeType: row.mimeType || stored.mimeType || 'application/octet-stream',
      filename: row.arquivoNome || 'comprovante-pix',
    };
  }

  async baixarAnexoLancamento(clienteId: string, lancamentoId: string) {
    const row = await this.prisma.clienteContaCorrenteLancamento.findFirst({
      where: { id: lancamentoId, clienteId },
      select: { anexoStorageKey: true, anexoNome: true, anexoMime: true },
    });
    if (!row?.anexoStorageKey) {
      throw new NotFoundException('Este lançamento não tem anexo.');
    }
    const stored = await this.storage.getBuffer(row.anexoStorageKey);
    return {
      buffer: stored.buffer,
      mimeType: row.anexoMime || stored.mimeType || 'application/octet-stream',
      filename: row.anexoNome || 'anexo-lancamento',
    };
  }

  async conferirComprovante(
    clienteId: string,
    comprovanteId: string,
    dto: DecidirPixCreditoComprovanteDto,
    user: AuthUser,
    ip?: string,
    userAgent?: string,
  ) {
    const cliente = await this.carregarCliente(clienteId);
    const row = await this.prisma.clientePixCreditoComprovante.findFirst({
      where: { id: comprovanteId, clienteId },
    });
    if (!row) throw new NotFoundException('Comprovante não encontrado.');
    if (row.status !== StatusPixCreditoComprovante.PENDENTE) {
      throw new BadRequestException('Este comprovante já foi analisado.');
    }
    const aprovado = dto.decisao === DecisaoPixCreditoComprovante.APROVADO;
    const observacao = (dto.observacao ?? '').trim();
    if (!aprovado && observacao.length < 3) {
      throw new BadRequestException('Descreva a inconsistência para negar o comprovante.');
    }
    const status = aprovado
      ? StatusPixCreditoComprovante.APROVADO
      : StatusPixCreditoComprovante.NEGADO;
    await this.prisma.clientePixCreditoComprovante.update({
      where: { id: row.id },
      data: {
        status,
        conferidoPorUserId: user.id,
        conferidoPorNome: user.email,
        conferidoEm: new Date(),
        decisaoObservacao: observacao || null,
      },
    });
    await this.auditoria.registrar({
      tabela: 'cliente_pix_credito_comprovantes',
      registroId: row.id,
      acao: AcaoAuditoria.UPDATE,
      usuario: user.id,
      dadosAntes: { status: row.status },
      dadosDepois: { status, clienteId, observacao: observacao || null },
      ip,
      userAgent,
    });
    const valor = toMoneyNumber(row.valor);
    try {
      if (aprovado) {
        await this.notificacoes.criarPixCreditoAprovado({
          clienteId,
          tenantId: cliente.tenantId,
          valor,
        });
      } else {
        await this.notificacoes.criarPixCreditoNegado({
          clienteId,
          tenantId: cliente.tenantId,
          valor,
          motivo: observacao,
        });
      }
    } catch {
      /* a decisão já está gravada; a inbox do portal não bloqueia o financeiro */
    }
    return this.obter(clienteId);
  }

  async saldoCliente(
    clienteId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    const agg = await db.clienteContaCorrenteLancamento.aggregate({
      where: { clienteId },
      _sum: { valorSinal: true },
    });
    return toMoneyNumber(agg._sum.valorSinal);
  }

  /**
   * Débito na mesma transação da solicitação. Recusa se o saldo ficaria negativo.
   * Autorização gerencial para saldo negativo fica para um passo seguinte.
   */
  async debitarNaTransacao(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      clienteId: string;
      valor: number;
      descricao: string;
      referencia?: string | null;
      createdByUserId?: string | null;
      createdByNome?: string | null;
    },
  ): Promise<{ saldoAntes: number; saldoDepois: number }> {
    const valor = toMoneyNumber(params.valor);
    if (valor <= 0) {
      throw new BadRequestException('Informe um valor maior que zero para debitar a conta comercial.');
    }
    const saldoAntes = await this.saldoCliente(params.clienteId, tx);
    const saldoDepois = toMoneyNumber(saldoAntes - valor);
    if (saldoDepois < -0.005) {
      throw new ConflictException({
        code: 'SALDO_CONTA_COMERCIAL_INSUFICIENTE',
        message:
          'Saldo insuficiente na conta comercial para quitar este ID. Recarregue a conta via PIX e tente novamente.',
        saldo: saldoAntes,
        valor,
        saldoApos: saldoDepois,
      });
    }
    const sinal = valorSinalLancamento(TipoLancamentoContaCorrente.DEBITO, valor);
    await tx.clienteContaCorrenteLancamento.create({
      data: {
        tenantId: params.tenantId,
        clienteId: params.clienteId,
        tipo: TipoLancamentoContaCorrente.DEBITO,
        valor: new Prisma.Decimal(Math.abs(sinal).toFixed(2)),
        valorSinal: new Prisma.Decimal(sinal.toFixed(2)),
        motivo: MotivoLancamentoContaCorrente.QUITACAO_ID,
        descricao: params.descricao.trim().slice(0, 500),
        referencia: params.referencia?.trim().slice(0, 120) || null,
        createdByUserId: params.createdByUserId ?? null,
        createdByNome: params.createdByNome?.trim().slice(0, 120) || null,
      },
    });
    return { saldoAntes, saldoDepois };
  }

  async lancar(
    clienteId: string,
    dto: CriarLancamentoContaCorrenteDto,
    user: AuthUser,
    ip?: string,
    userAgent?: string,
    anexo?: Express.Multer.File,
  ) {
    if (dto.motivo === MotivoLancamentoContaCorrente.COMPENSACAO) {
      throw new BadRequestException('Use a ação Compensar para zerar o saldo.');
    }
    return this.gravar(clienteId, dto, user, ip, userAgent, anexo);
  }

  async compensar(
    clienteId: string,
    dto: CompensarContaCorrenteDto,
    user: AuthUser,
    ip?: string,
    userAgent?: string,
  ) {
    const atual = await this.obter(clienteId);
    if (atual.cliente.situacao === 'ZERADO') {
      throw new BadRequestException('Não há saldo para compensar.');
    }
    const tipo =
      atual.cliente.saldo > 0
        ? TipoLancamentoContaCorrente.DEBITO
        : TipoLancamentoContaCorrente.CREDITO;
    const valor = Math.abs(atual.cliente.saldo);
    const descricao =
      dto.descricao?.trim() ||
      (tipo === TipoLancamentoContaCorrente.DEBITO
        ? 'Compensação do crédito na fatura/pagamento'
        : 'Compensação do valor em aberto na fatura/pagamento');
    return this.gravar(
      clienteId,
      {
        tipo,
        valor,
        motivo: MotivoLancamentoContaCorrente.COMPENSACAO,
        descricao,
        referencia: dto.referencia,
      },
      user,
      ip,
      userAgent,
    );
  }

  private async gravar(
    clienteId: string,
    dto: CriarLancamentoContaCorrenteDto,
    user: AuthUser,
    ip?: string,
    userAgent?: string,
    anexo?: Express.Multer.File,
  ) {
    const cliente = await this.carregarCliente(clienteId);
    const sinal = valorSinalLancamento(dto.tipo, dto.valor);
    const valor = new Prisma.Decimal(Math.abs(sinal).toFixed(2));
    const valorSinal = new Prisma.Decimal(sinal.toFixed(2));
    const motivo = dto.motivo ?? MotivoLancamentoContaCorrente.OUTRO;
    const descricao = dto.descricao.trim();
    const referencia = dto.referencia?.trim() || null;
    const anexoMeta = await this.persistirAnexoLancamento(clienteId, anexo);

    const row = await this.prisma.clienteContaCorrenteLancamento.create({
      data: {
        tenantId: cliente.tenantId,
        clienteId,
        tipo: dto.tipo,
        valor,
        valorSinal,
        motivo,
        descricao,
        referencia,
        anexoNome: anexoMeta?.nome ?? null,
        anexoMime: anexoMeta?.mime ?? null,
        anexoStorageKey: anexoMeta?.storageKey ?? null,
        anexoTamanho: anexoMeta?.tamanho ?? null,
        createdByUserId: user.id,
        createdByNome: user.email,
      },
    });

    await this.auditoria.registrar({
      tabela: 'cliente_conta_corrente_lancamentos',
      registroId: row.id,
      acao: AcaoAuditoria.INSERT,
      usuario: user.id,
      dadosDepois: {
        clienteId,
        tipo: dto.tipo,
        valor: Number(valor),
        motivo,
        descricao,
        referencia,
        anexo: anexoMeta?.nome ?? null,
      },
      ip,
      userAgent,
    });

    return this.obter(clienteId);
  }

  private async persistirAnexoLancamento(
    clienteId: string,
    file?: Express.Multer.File,
  ): Promise<{ nome: string; mime: string; storageKey: string; tamanho: number } | null> {
    if (!file?.buffer?.length) return null;
    if (file.size > ANEXO_LANCAMENTO_MAX) {
      throw new BadRequestException('O anexo não pode passar de 5 MB.');
    }
    const mime = (file.mimetype || '').toLowerCase();
    if (!ANEXO_LANCAMENTO_MIMES.has(mime)) {
      throw new BadRequestException('Use PDF, JPG, PNG ou WEBP como anexo.');
    }
    const nome = (file.originalname || 'anexo').replace(/[^\w.\- ()áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/g, '_').slice(0, 180);
    const stored = await this.storage.upload({
      key: `financeiro/conta-corrente/${clienteId}/${randomUUID()}_${nome}`,
      body: file.buffer,
      contentType: mime,
    });
    return { nome, mime, storageKey: stored.storageKey, tamanho: file.size };
  }

  private async carregarCliente(clienteId: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, deletedAt: null },
      select: CLIENTE_SELECT,
    });
    if (!cliente) throw new NotFoundException('Cliente não encontrado.');
    return cliente;
  }

  private toClienteResumo(
    cliente: { id: string; razaoSocial: string; nomeFantasia: string | null; cpfCnpj: string },
    saldo: number,
    lancamentos: number,
    comprovantesPendentes = 0,
  ) {
    return {
      id: cliente.id,
      razaoSocial: cliente.razaoSocial,
      nomeFantasia: cliente.nomeFantasia,
      cpfCnpj: cliente.cpfCnpj,
      saldo,
      lancamentos,
      comprovantesPendentes,
      situacao: classificarSaldo(saldo),
      situacaoLabel: rotuloSaldo(saldo),
    };
  }

  private toComprovante(row: {
    id: string;
    valor: Prisma.Decimal;
    referenciaExterna: string | null;
    arquivoNome: string;
    mimeType: string;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      valor: toMoneyNumber(row.valor),
      referenciaExterna: row.referenciaExterna,
      arquivoNome: row.arquivoNome,
      mimeType: row.mimeType,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toLancamento(row: {
    id: string;
    tipo: TipoLancamentoContaCorrente;
    valor: Prisma.Decimal;
    valorSinal: Prisma.Decimal;
    motivo: MotivoLancamentoContaCorrente;
    descricao: string;
    referencia: string | null;
    anexoNome?: string | null;
    anexoMime?: string | null;
    createdByNome: string | null;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      tipo: row.tipo,
      valor: toMoneyNumber(row.valor),
      valorSinal: toMoneyNumber(row.valorSinal),
      motivo: row.motivo,
      motivoLabel: MOTIVO_CONTA_CORRENTE_LABEL[row.motivo],
      descricao: row.descricao,
      referencia: row.referencia,
      anexoNome: row.anexoNome ?? null,
      anexoMime: row.anexoMime ?? null,
      createdByNome: row.createdByNome,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
