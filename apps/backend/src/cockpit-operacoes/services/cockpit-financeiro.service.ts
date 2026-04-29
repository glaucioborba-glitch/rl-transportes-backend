import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CockpitFinanceiroService {
  constructor(private readonly prisma: PrismaService) {}

  async riscos() {
    try {
      const [nfePend, boletosVenc, fatAlto] = await Promise.all([
        this.prisma.faturamento.findMany({
          where: { statusNfe: { contains: 'pend', mode: 'insensitive' } },
          take: 40,
          select: { id: true, clienteId: true, periodo: true, valorTotal: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.boleto.findMany({
          where: {
            statusPagamento: { contains: 'pend', mode: 'insensitive' },
            dataVencimento: { lt: new Date() },
          },
          take: 40,
          include: { faturamento: { select: { clienteId: true, periodo: true } } },
          orderBy: { dataVencimento: 'asc' },
        }),
        this.prisma.faturamento.findMany({
          take: 15,
          orderBy: { valorTotal: 'desc' },
          select: { id: true, clienteId: true, periodo: true, valorTotal: true },
        }),
      ]);

      const inadimplenciaPorCliente = this.agruparBoletos(boletosVenc);

      return {
        geradoEm: new Date().toISOString(),
        notasPendentes: nfePend.map((n) => ({
          faturamentoId: n.id,
          clienteId: n.clienteId,
          periodo: n.periodo,
          valor: Number(n.valorTotal),
          atualizadoEm: n.updatedAt.toISOString(),
        })),
        divergenciasFiscaisProxy: [],
        pagamentosCriticos: boletosVenc.map((b) => ({
          boletoId: b.id,
          clienteId: b.faturamento.clienteId,
          vencimento: b.dataVencimento.toISOString(),
          valor: Number(b.valorBoleto),
        })),
        riscoInadimplenciaPorCliente: inadimplenciaPorCliente,
        exposicaoValorAlvoProxy: fatAlto.map((f) => ({
          clienteId: f.clienteId,
          periodo: f.periodo,
          valor: Number(f.valorTotal),
        })),
      };
    } catch {
      return {
        geradoEm: new Date().toISOString(),
        notasPendentes: [],
        divergenciasFiscaisProxy: [],
        pagamentosCriticos: [],
        riscoInadimplenciaPorCliente: [],
        exposicaoValorAlvoProxy: [],
        observacao:
          'Agregação fiscal/financeira indisponível (schema DB pode estar atrás do Prisma — rode migrations).',
      };
    }
  }

  async eventos() {
    try {
      const [nfs, boletos] = await Promise.all([
        this.prisma.nfsEmitida.findMany({
          take: 50,
          orderBy: { updatedAt: 'desc' },
          select: { id: true, numeroNfe: true, statusIpm: true, faturamentoId: true, updatedAt: true },
        }),
        this.prisma.boleto.findMany({
          take: 50,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            numeroBoleto: true,
            statusPagamento: true,
            valorBoleto: true,
            dataVencimento: true,
            updatedAt: true,
          },
        }),
      ]);
      return {
        geradoEm: new Date().toISOString(),
        nfsRecentes: nfs.map((n) => ({
          id: n.id,
          numero: n.numeroNfe,
          status: n.statusIpm,
          em: n.updatedAt.toISOString(),
        })),
        boletosRecentes: boletos.map((b) => ({
          id: b.id,
          status: b.statusPagamento,
          valor: Number(b.valorBoleto),
          vencimento: b.dataVencimento.toISOString(),
          em: b.updatedAt.toISOString(),
        })),
      };
    } catch {
      return {
        geradoEm: new Date().toISOString(),
        nfsRecentes: [],
        boletosRecentes: [],
        observacao: 'Eventos fiscais indisponíveis (verifique migrations).',
      };
    }
  }

  private agruparBoletos(
    boletos: Array<{ faturamento: { clienteId: string }; valorBoleto: { toString(): string } }>,
  ) {
    const m = new Map<string, { count: number; valor: number }>();
    for (const b of boletos) {
      const cid = b.faturamento.clienteId;
      const cur = m.get(cid) ?? { count: 0, valor: 0 };
      cur.count += 1;
      cur.valor += Number(b.valorBoleto);
      m.set(cid, cur);
    }
    return [...m.entries()]
      .map(([clienteId, v]) => ({ clienteId, ...v }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 30);
  }
}
