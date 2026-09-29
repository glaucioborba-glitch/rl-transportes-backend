import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatusAluguel, StatusSolicitacaoAluguel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { formatUnidadeProcessoId } from '../unidade-processo/unidade-direcao.util';
import type { CxPortalRequestUser } from '../cx-portais/types/cx-portal.types';
import type { CriarSolicitacaoAluguelDto } from './dto/solicitacao-aluguel.dto';

const solicitacaoInclude = {
  cliente: { select: { razaoSocial: true, nomeFantasia: true } },
  _count: { select: { alugueis: true } },
  alugueis: {
    orderBy: { iniciadoEm: 'desc' as const },
    take: 1,
    include: {
      unidadeAluguel: { select: { unidadeIso: true } },
      unidadeProcesso: { select: { numero: true } },
    },
  },
} satisfies Prisma.SolicitacaoAluguelInclude;

function parseYmd(raw: string, campo: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) throw new BadRequestException(`Informe ${campo} no formato AAAA-MM-DD.`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    throw new BadRequestException(`${campo} inválida.`);
  }
  return dt;
}

function todayUtcYmd(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class SolicitacaoAluguelService {
  constructor(private readonly prisma: PrismaService) {}

  private async nextProtocolo(): Promise<string> {
    const rows = await this.prisma.$queryRaw<Array<{ n: bigint | number }>>`
      SELECT nextval('solicitacoes_aluguel_protocolo_seq') AS n
    `;
    return `ALU-${Number(rows[0]?.n ?? 0)}`;
  }

  private mapRow(row: {
    id: string;
    protocolo: string;
    clienteId: string;
    quantidade: number;
    finalidade: string;
    dataColeta: Date | null;
    dataPrevistaDevolucao: Date | null;
    status: StatusSolicitacaoAluguel;
    motivoRejeicao: string | null;
    createdAt: Date;
    updatedAt: Date;
    autorizadoEm: Date | null;
    cliente?: { razaoSocial: string; nomeFantasia?: string | null } | null;
    _count?: { alugueis?: number };
    alugueis?: Array<{
      status: StatusAluguel;
      unidadeAluguel?: { unidadeIso: string };
      unidadeProcesso?: { numero: number };
    }>;
  }) {
    const contrato = row.alugueis?.[0];
    return {
      id: row.id,
      protocolo: row.protocolo,
      clienteId: row.clienteId,
      empresa: row.cliente?.nomeFantasia || row.cliente?.razaoSocial || null,
      iniciados: row._count?.alugueis ?? 0,
      quantidade: row.quantidade,
      finalidade: row.finalidade,
      dataColeta: row.dataColeta ? toIsoDate(row.dataColeta) : null,
      dataPrevistaDevolucao: row.dataPrevistaDevolucao ? toIsoDate(row.dataPrevistaDevolucao) : null,
      status: row.status,
      motivoRejeicao: row.motivoRejeicao,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      autorizadoEm: row.autorizadoEm?.toISOString() ?? null,
      contrato: contrato
        ? {
            unidadeIso: contrato.unidadeAluguel?.unidadeIso ?? null,
            numero: contrato.unidadeProcesso?.numero ?? null,
            idLabel: contrato.unidadeProcesso
              ? formatUnidadeProcessoId(contrato.unidadeProcesso.numero)
              : null,
            status: contrato.status,
          }
        : null,
    };
  }

  private resolveClienteId(cx: CxPortalRequestUser): string {
    if (!cx.clienteId) {
      throw new BadRequestException('Usuário portal sem vínculo de cliente');
    }
    return cx.clienteId;
  }

  async criarPortal(dto: CriarSolicitacaoAluguelDto, cx: CxPortalRequestUser) {
    const clienteId = this.resolveClienteId(cx);
    const rawEntrega = dto.dataColeta?.trim() || '';
    const rawDevolucao = dto.dataPrevistaDevolucao?.trim() || '';
    const dataColeta = rawEntrega ? parseYmd(rawEntrega, 'a coleta prevista') : null;
    const dataPrevistaDevolucao = rawDevolucao
      ? parseYmd(rawDevolucao, 'a previsão de devolução')
      : null;
    if (dataColeta && dataColeta < todayUtcYmd()) {
      throw new BadRequestException('A coleta prevista não pode ser anterior a hoje.');
    }
    if (dataColeta && dataPrevistaDevolucao && dataPrevistaDevolucao <= dataColeta) {
      throw new BadRequestException('A previsão de devolução deve ser depois da coleta prevista.');
    }
    if (dataPrevistaDevolucao && dataPrevistaDevolucao < todayUtcYmd()) {
      throw new BadRequestException('A previsão de devolução não pode ser anterior a hoje.');
    }

    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, deletedAt: null },
      select: { id: true },
    });
    if (!cliente) throw new BadRequestException('Cliente não encontrado');

    for (let attempt = 0; attempt < 4; attempt++) {
      const protocolo = await this.nextProtocolo();
      try {
        const created = await this.prisma.solicitacaoAluguel.create({
          data: {
            protocolo,
            clienteId,
            quantidade: 1,
            finalidade: dto.finalidade,
            ...(dataColeta ? { dataColeta } : {}),
            ...(dataPrevistaDevolucao ? { dataPrevistaDevolucao } : {}),
            status: StatusSolicitacaoAluguel.PENDENTE,
            createdBySub: cx.sub,
          },
          include: solicitacaoInclude,
        });
        return this.mapRow(created);
      } catch (e) {
        const code = (e as { code?: string })?.code;
        if (code === 'P2002' && attempt < 3) continue;
        throw e;
      }
    }
    throw new BadRequestException('Não foi possível gerar o protocolo do aluguel.');
  }

  async listarPortal(cx: CxPortalRequestUser) {
    const clienteId = this.resolveClienteId(cx);
    const rows = await this.prisma.solicitacaoAluguel.findMany({
      where: { clienteId },
      include: solicitacaoInclude,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { items: rows.map((r) => this.mapRow(r)), total: rows.length };
  }

  async listarStaff(status?: StatusSolicitacaoAluguel) {
    const where = status ? { status } : undefined;
    const [rows, total] = await Promise.all([
      this.prisma.solicitacaoAluguel.findMany({
        where,
        include: solicitacaoInclude,
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.solicitacaoAluguel.count({ where }),
    ]);
    return { items: rows.map((r) => this.mapRow(r)), total };
  }

  async obterStaff(id: string) {
    const row = await this.prisma.solicitacaoAluguel.findFirst({
      where: { id },
      include: solicitacaoInclude,
    });
    if (!row) throw new NotFoundException('Solicitação de aluguel não encontrada');
    return this.mapRow(row);
  }

  async listarReservasPatio() {
    const rows = await this.prisma.solicitacaoAluguel.findMany({
      where: {
        status: StatusSolicitacaoAluguel.APROVADO,
      },
      include: solicitacaoInclude,
      orderBy: { autorizadoEm: 'asc' },
      take: 100,
    });
    const items = rows
      .filter((r) => r._count.alugueis < r.quantidade)
      .map((r) => this.mapRow(r));
    return { items, total: items.length };
  }

  async listarMotivosRejeicao() {
    const rows = await this.prisma.cadastroMotivoRejeicao.findMany({
      where: { tipo: 'REJEICAO_ALUGUEL', ativo: true, deletedAt: null },
      orderBy: { descricao: 'asc' },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        codigo: r.codigo,
        descricao: r.descricao,
        exigeObservacao: r.exigeObservacao,
      })),
      total: rows.length,
    };
  }

  async aprovarStaff(id: string, userId: string) {
    const row = await this.obterPendente(id);
    const updated = await this.prisma.solicitacaoAluguel.update({
      where: { id: row.id },
      data: {
        status: StatusSolicitacaoAluguel.APROVADO,
        autorizadoPorUserId: userId,
        autorizadoEm: new Date(),
        motivoRejeicao: null,
      },
      include: solicitacaoInclude,
    });
    return this.mapRow(updated);
  }

  async rejeitarStaff(id: string, userId: string, motivo: string) {
    const row = await this.obterPendente(id);
    const texto = motivo.trim();
    if (!texto) throw new BadRequestException('Informe o motivo da rejeição.');
    const updated = await this.prisma.solicitacaoAluguel.update({
      where: { id: row.id },
      data: {
        status: StatusSolicitacaoAluguel.REJEITADO,
        autorizadoPorUserId: userId,
        autorizadoEm: new Date(),
        motivoRejeicao: texto.slice(0, 500),
      },
      include: solicitacaoInclude,
    });
    return this.mapRow(updated);
  }

  private async obterPendente(id: string) {
    const row = await this.prisma.solicitacaoAluguel.findFirst({ where: { id } });
    if (!row) throw new NotFoundException('Solicitação de aluguel não encontrada');
    if (row.status !== StatusSolicitacaoAluguel.PENDENTE) {
      throw new BadRequestException('Esta solicitação de aluguel já foi decidida.');
    }
    return row;
  }
}
