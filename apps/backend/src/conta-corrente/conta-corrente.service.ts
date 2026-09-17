import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AcaoAuditoria,
  MotivoLancamentoContaCorrente,
  Prisma,
  TipoLancamentoContaCorrente,
} from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import type { ContaCorrenteQueryDto } from './dto/conta-corrente-query.dto';
import type {
  CompensarContaCorrenteDto,
  CriarLancamentoContaCorrenteDto,
} from './dto/criar-lancamento-conta-corrente.dto';
import {
  MOTIVO_CONTA_CORRENTE_LABEL,
  classificarSaldo,
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

    const items = clientes
      .map((c) => {
        const agg = porCliente.get(c.id) ?? { saldo: 0, lancamentos: 0 };
        return this.toClienteResumo(c, agg.saldo, agg.lancamentos);
      })
      .filter((row) => !query.somenteComSaldo || row.situacao !== 'ZERADO')
      .sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo) || a.razaoSocial.localeCompare(b.razaoSocial, 'pt-BR'));

    return { items };
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
    return {
      cliente: this.toClienteResumo(cliente, saldo, lancamentos.length),
      lancamentos: lancamentos.map((l) => this.toLancamento(l)),
    };
  }

  async lancar(
    clienteId: string,
    dto: CriarLancamentoContaCorrenteDto,
    user: AuthUser,
    ip?: string,
    userAgent?: string,
  ) {
    if (dto.motivo === MotivoLancamentoContaCorrente.COMPENSACAO) {
      throw new BadRequestException('Use a ação Compensar para zerar o saldo.');
    }
    return this.gravar(clienteId, dto, user, ip, userAgent);
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
  ) {
    const cliente = await this.carregarCliente(clienteId);
    const sinal = valorSinalLancamento(dto.tipo, dto.valor);
    const valor = new Prisma.Decimal(Math.abs(sinal).toFixed(2));
    const valorSinal = new Prisma.Decimal(sinal.toFixed(2));
    const motivo = dto.motivo ?? MotivoLancamentoContaCorrente.OUTRO;
    const descricao = dto.descricao.trim();
    const referencia = dto.referencia?.trim() || null;

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
      },
      ip,
      userAgent,
    });

    return this.obter(clienteId);
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
  ) {
    return {
      id: cliente.id,
      razaoSocial: cliente.razaoSocial,
      nomeFantasia: cliente.nomeFantasia,
      cpfCnpj: cliente.cpfCnpj,
      saldo,
      lancamentos,
      situacao: classificarSaldo(saldo),
      situacaoLabel: rotuloSaldo(saldo),
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
      createdByNome: row.createdByNome,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
