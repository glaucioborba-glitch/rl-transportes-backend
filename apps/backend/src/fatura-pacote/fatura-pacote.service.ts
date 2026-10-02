import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ModoFaturamentoCliente,
  Prisma,
  StatusFaturaPacote,
  StatusPagamentoFatura,
  StatusPreFatura,
} from '@prisma/client';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { formatUnidadeProcessoId } from '../unidade-processo/unidade-direcao.util';

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function toMoney(v: unknown): number {
  return Number(v ?? 0);
}

function splitDescricaoItem(descricao: string): { titulo: string; detalhe: string | null } {
  const sep = ' — ';
  const i = descricao.indexOf(sep);
  if (i <= 0) return { titulo: descricao, detalhe: null };
  const detalhe = descricao.slice(i + sep.length).trim();
  return { titulo: descricao.slice(0, i).trim(), detalhe: detalhe || null };
}

function normIso(iso: string): string {
  return iso.replace(/\s/g, '').toUpperCase();
}

function docsDoContainer(
  iso: string,
  containers: Array<{ unidade: string; booking: string; processo: string }>,
): { processo: string; booking: string } {
  const hit =
    containers.find((c) => normIso(c.unidade) === normIso(iso)) ?? containers[0] ?? null;
  return {
    processo: hit?.processo?.trim() || '',
    booking: hit?.booking?.trim() || '',
  };
}

@Injectable()
export class FaturaPacoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async listarFila() {
    const pendentes = await this.prisma.fatura.findMany({
      where: this.filaWhere(),
      include: this.filaInclude(),
      orderBy: { dataEmissao: 'asc' },
      take: 400,
    });
    const byCliente = new Map<string, typeof pendentes>();
    for (const row of pendentes) {
      const list = byCliente.get(row.clienteId) ?? [];
      list.push(row);
      byCliente.set(row.clienteId, list);
    }
    const clientes = await this.prisma.cliente.findMany({
      where: { id: { in: [...byCliente.keys()] }, deletedAt: null },
      select: {
        id: true,
        razaoSocial: true,
        nomeFantasia: true,
        cpfCnpj: true,
        condicaoPagamento: true,
        prazoPagamento: true,
        faturamentoModo: true,
        faturamentoHora: true,
      },
    });
    const enviadas = await this.prisma.faturaPacote.findMany({
      where: {
        status: {
          in: [StatusFaturaPacote.ENVIADA, StatusFaturaPacote.EMITINDO, StatusFaturaPacote.RASCUNHO],
        },
      },
      include: { cliente: { select: { razaoSocial: true, nomeFantasia: true } } },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    return {
      clientes: clientes
        .map((c) => {
          const ids = (byCliente.get(c.id) ?? []).map((row) => this.mapId(row));
          return {
            ...c,
            ids,
            total: ids.reduce((s, i) => s + i.valorTotal, 0),
          };
        })
        .sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial, 'pt-BR')),
      enviadas: enviadas.map((p) => ({
        id: p.id,
        numero: p.numero,
        clienteId: p.clienteId,
        clienteNome: p.cliente.nomeFantasia || p.cliente.razaoSocial,
        status: p.status,
        modo: p.modo,
        valorTotal: toMoney(p.valorTotal),
        dataEmissao: p.dataEmissao?.toISOString() ?? null,
        agendadoPara: p.agendadoPara?.toISOString() ?? null,
        linkNfse: p.linkNfse,
        linkBoleto: p.linkBoleto,
        linkPix: p.linkPix,
      })),
    };
  }

  async obterCliente(clienteId: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, deletedAt: null },
      select: {
        id: true,
        razaoSocial: true,
        nomeFantasia: true,
        cpfCnpj: true,
        condicaoPagamento: true,
        prazoPagamento: true,
        faturamentoModo: true,
        faturamentoHora: true,
      },
    });
    if (!cliente) throw new NotFoundException('Cliente não encontrado.');
    const rows = await this.prisma.fatura.findMany({
      where: { ...this.filaWhere(), clienteId },
      include: this.filaInclude(),
      orderBy: { dataEmissao: 'asc' },
    });
    const ids = rows.map((row) => this.mapId(row));
    return { cliente, ids, total: ids.reduce((s, i) => s + i.valorTotal, 0) };
  }

  async obterPacote(id: string) {
    const pacote = await this.prisma.faturaPacote.findFirst({
      where: { id },
      include: {
        cliente: {
          select: {
            id: true,
            razaoSocial: true,
            nomeFantasia: true,
            cpfCnpj: true,
            condicaoPagamento: true,
            prazoPagamento: true,
            faturamentoModo: true,
            faturamentoHora: true,
          },
        },
        faturas: { include: this.filaInclude(), orderBy: { dataEmissao: 'asc' } },
      },
    });
    if (!pacote) throw new NotFoundException('Fatura não encontrada.');
    const ids = pacote.faturas.map((row) => this.mapId(row));
    return {
      id: pacote.id,
      numero: pacote.numero,
      status: pacote.status,
      modo: pacote.modo,
      valorTotal: toMoney(pacote.valorTotal),
      dataEmissao: pacote.dataEmissao?.toISOString() ?? null,
      agendadoPara: pacote.agendadoPara?.toISOString() ?? null,
      dataVencimento: pacote.dataVencimento?.toISOString() ?? null,
      linkNfse: pacote.linkNfse,
      linkBoleto: pacote.linkBoleto,
      linkPix: pacote.linkPix,
      processamentoErro: pacote.processamentoErro,
      cliente: pacote.cliente,
      ids,
    };
  }

  async emitir(clienteId: string, faturaIds: string[], modo: ModoFaturamentoCliente) {
    const { unique, cliente, valorTotal } = await this.assertFila(clienteId, faturaIds);
    const pacote = await this.prisma.$transaction(async (tx) => {
      const created = await this.criarPacote(tx, {
        tenantId: cliente.tenantId,
        clienteId,
        modo,
        valorTotal,
        faturaIds: unique,
        status: StatusFaturaPacote.EMITINDO,
      });
      if (modo === ModoFaturamentoCliente.AUTOMATICO) {
        await tx.cliente.update({
          where: { id: clienteId },
          data: { faturamentoAutoRodouEm: new Date() },
        });
      }
      return created;
    });
    return { id: pacote.id, numero: pacote.numero, valorTotal, status: pacote.status };
  }

  async agendar(clienteId: string, faturaIds: string[], agendadoParaIso: string) {
    const quando = this.parseAgendadoPara(agendadoParaIso);
    const { unique, cliente, valorTotal } = await this.assertFila(clienteId, faturaIds);
    const pacote = await this.prisma.$transaction(async (tx) => {
      return this.criarPacote(tx, {
        tenantId: cliente.tenantId,
        clienteId,
        modo: ModoFaturamentoCliente.MANUAL,
        valorTotal,
        faturaIds: unique,
        status: StatusFaturaPacote.RASCUNHO,
        agendadoPara: quando,
        enqueue: false,
      });
    });
    return {
      id: pacote.id,
      numero: pacote.numero,
      valorTotal,
      status: pacote.status,
      agendadoPara: quando.toISOString(),
    };
  }

  async emitirAutomaticosNaHora(agora = new Date()) {
    const agendadas = await this.emitirAgendados(agora);
    const hora = agora.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const hoje = agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const clientes = await this.prisma.cliente.findMany({
      where: {
        deletedAt: null,
        faturamentoModo: ModoFaturamentoCliente.AUTOMATICO,
        faturamentoHora: { not: null },
      },
      select: { id: true, faturamentoHora: true, faturamentoAutoRodouEm: true },
    });
    const resultados: Array<{ clienteId: string; numero?: string; ids?: number; skipped?: string }> = [];
    for (const c of clientes) {
      if (!c.faturamentoHora || c.faturamentoHora > hora) {
        resultados.push({ clienteId: c.id, skipped: 'hora' });
        continue;
      }
      const ultima = c.faturamentoAutoRodouEm
        ? c.faturamentoAutoRodouEm.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
        : null;
      if (ultima === hoje) {
        resultados.push({ clienteId: c.id, skipped: 'ja_rodou' });
        continue;
      }
      const fila = await this.prisma.fatura.findMany({
        where: { ...this.filaWhere(), clienteId: c.id },
        select: { id: true },
      });
      if (!fila.length) {
        await this.prisma.cliente.update({
          where: { id: c.id },
          data: { faturamentoAutoRodouEm: agora },
        });
        resultados.push({ clienteId: c.id, skipped: 'fila_vazia' });
        continue;
      }
      const out = await this.emitir(
        c.id,
        fila.map((f) => f.id),
        ModoFaturamentoCliente.AUTOMATICO,
      );
      resultados.push({ clienteId: c.id, numero: out.numero, ids: fila.length });
    }
    return { hora, hoje, resultados, agendadas };
  }

  async emitirAgendados(agora = new Date()) {
    const due = await this.prisma.faturaPacote.findMany({
      where: {
        status: StatusFaturaPacote.RASCUNHO,
        agendadoPara: { lte: agora },
      },
      select: { id: true, clienteId: true, numero: true },
    });
    const resultados: Array<{ id: string; numero: string; skipped?: string }> = [];
    for (const p of due) {
      try {
        await this.dispararPacote(p.id);
        resultados.push({ id: p.id, numero: p.numero });
      } catch {
        resultados.push({ id: p.id, numero: p.numero, skipped: 'erro' });
      }
    }
    return resultados;
  }

  private parseAgendadoPara(iso: string): Date {
    const quando = new Date(iso);
    if (Number.isNaN(quando.getTime())) {
      throw new BadRequestException('Informe data e hora válidas para a emissão.');
    }
    if (quando.getTime() <= Date.now() - 30_000) {
      throw new BadRequestException('A data/hora de emissão precisa ser no futuro.');
    }
    return quando;
  }

  private async assertFila(clienteId: string, faturaIds: string[]) {
    const unique = [...new Set(faturaIds.filter(Boolean))];
    if (!unique.length) throw new BadRequestException('Marque ao menos um ID para cobrar.');
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, deletedAt: null },
    });
    if (!cliente) throw new NotFoundException('Cliente não encontrado.');
    const rows = await this.prisma.fatura.findMany({
      where: { id: { in: unique }, clienteId, ...this.filaWhere() },
    });
    if (rows.length !== unique.length) {
      throw new BadRequestException('Algum ID já foi faturado ou não pertence a este cliente.');
    }
    const valorTotal = rows.reduce((s, r) => s + toMoney(r.valorTotal), 0);
    if (valorTotal <= 0) throw new BadRequestException('Os IDs selecionados não têm valor a cobrar.');
    return { unique, cliente, valorTotal };
  }

  private async criarPacote(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string;
      clienteId: string;
      modo: ModoFaturamentoCliente;
      valorTotal: number;
      faturaIds: string[];
      status: StatusFaturaPacote;
      agendadoPara?: Date;
      enqueue?: boolean;
    },
  ) {
    const numero = await this.nextNumero(tx, input.tenantId);
    const created = await tx.faturaPacote.create({
      data: {
        tenantId: input.tenantId,
        clienteId: input.clienteId,
        numero,
        modo: input.modo,
        status: input.status,
        valorTotal: input.valorTotal,
        agendadoPara: input.agendadoPara ?? null,
      },
    });
    await tx.fatura.updateMany({
      where: { id: { in: input.faturaIds } },
      data: {
        faturaPacoteId: created.id,
        ...(input.status === StatusFaturaPacote.EMITINDO
          ? { statusPagamento: StatusPagamentoFatura.PROCESSANDO }
          : {}),
      },
    });
    if (input.enqueue !== false && input.status === StatusFaturaPacote.EMITINDO) {
      await this.outbox.enqueue(tx, {
        aggregateType: 'FaturaPacote',
        aggregateId: created.id,
        eventType: 'EMITIR_FATURA_PACOTE',
        payload: { faturaPacoteId: created.id, clienteId: input.clienteId },
      });
    }
    return created;
  }

  private async dispararPacote(id: string) {
    await this.prisma.$transaction(async (tx) => {
      const pacote = await tx.faturaPacote.findFirst({
        where: { id, status: StatusFaturaPacote.RASCUNHO },
        include: { faturas: { select: { id: true } } },
      });
      if (!pacote) return;
      await tx.faturaPacote.update({
        where: { id },
        data: { status: StatusFaturaPacote.EMITINDO, dataEmissao: new Date() },
      });
      await tx.fatura.updateMany({
        where: { faturaPacoteId: id },
        data: { statusPagamento: StatusPagamentoFatura.PROCESSANDO },
      });
      await this.outbox.enqueue(tx, {
        aggregateType: 'FaturaPacote',
        aggregateId: id,
        eventType: 'EMITIR_FATURA_PACOTE',
        payload: { faturaPacoteId: id, clienteId: pacote.clienteId },
      });
    });
  }

  static assertHora(hora?: string | null) {
    const v = hora?.trim() || '';
    if (v && !HORA_RE.test(v)) {
      throw new BadRequestException('Informe a hora no formato HH:mm (ex.: 18:00).');
    }
    return v || null;
  }

  private filaWhere(): Prisma.FaturaWhereInput {
    return {
      faturaPacoteId: null,
      statusPagamento: StatusPagamentoFatura.PENDENTE,
      valorTotal: { gt: 0 },
      preFatura: { status: StatusPreFatura.CONSOLIDADA },
    };
  }

  private filaInclude() {
    return {
      preFatura: {
        include: {
          itens: { orderBy: { createdAt: 'asc' as const } },
          unidadeProcesso: {
            select: {
              id: true,
              numero: true,
              modalidade: true,
              unidadeIso: true,
              entradaEm: true,
              saidaEm: true,
              entradaSolicitacao: {
                select: {
                  containersSolicitacao: {
                    select: { unidade: true, booking: true, processo: true },
                  },
                },
              },
            },
          },
        },
      },
    };
  }

  private mapId(row: {
    id: string;
    valorTotal: unknown;
    dataEmissao: Date;
    preFatura: {
      containerIso: string;
      diasCobrados: number;
      gateInAt: Date;
      unidadeProcesso: {
        id: string;
        numero: number;
        modalidade: string;
        unidadeIso: string;
        entradaEm: Date;
        saidaEm: Date | null;
        entradaSolicitacao: {
          containersSolicitacao: Array<{ unidade: string; booking: string; processo: string }>;
        } | null;
      } | null;
      itens: Array<{
        id: string;
        descricao: string;
        quantidade: number;
        valorUnitario: unknown;
        valorTotal: unknown;
        eventoGatilho: string;
      }>;
    };
  }) {
    const proc = row.preFatura.unidadeProcesso;
    const iso = proc?.unidadeIso || row.preFatura.containerIso;
    const docs = docsDoContainer(iso, proc?.entradaSolicitacao?.containersSolicitacao ?? []);
    const entrada = proc?.entradaEm ?? row.preFatura.gateInAt;
    const saida = proc?.saidaEm ?? row.dataEmissao;
    return {
      faturaId: row.id,
      idLabel: proc ? formatUnidadeProcessoId(proc.numero) : '—',
      unidadeProcessoId: proc?.id ?? null,
      modalidade: proc?.modalidade ?? 'PATIO',
      unidadeIso: iso,
      processo: docs.processo,
      booking: docs.booking,
      diasCobrados: row.preFatura.diasCobrados,
      entradaEm: entrada.toISOString(),
      encerradoEm: saida.toISOString(),
      valorTotal: toMoney(row.valorTotal),
      composicao: row.preFatura.itens.map((i) => {
        const { titulo, detalhe } = splitDescricaoItem(i.descricao);
        return {
          id: i.id,
          descricao: titulo,
          detalheCobranca: detalhe,
          evento: i.eventoGatilho,
          quantidade: i.quantidade,
          valorUnitario: toMoney(i.valorUnitario),
          valorTotal: toMoney(i.valorTotal),
        };
      }),
    };
  }

  private async nextNumero(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `FAT-${ym}-`;
    const last = await tx.faturaPacote.findFirst({
      where: { tenantId, numero: { startsWith: prefix } },
      orderBy: { numero: 'desc' },
      select: { numero: true },
    });
    const seq = last ? Number(last.numero.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(Number.isFinite(seq) ? seq : 1).padStart(4, '0')}`;
  }
}
