import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AcaoAuditoria, Prisma, StatusPagamento } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  construirForecastFinanceiro,
  projetarDemanda12Meses,
  type MesValor,
} from '../planejamento-estrategico/planejamento-estrategico.calculations';
import type { BoletoConciliacaoInput } from './conciliacao.calculations';
import { motorConciliacaoAutomatica } from './conciliacao.calculations';
import { ExtratoStoreService } from './extrato-store.service';
import { parseCsvExtrato, parseOfxExtrato } from './extrato-parser';
import { agregarSerie12Meses, projetarFluxoCaixa } from './fluxo-caixa.calculations';
import type { ExtratoImportarDto } from './dto/financeiro-conciliacao-query.dto';
import type {
  ConciliacaoAutomaticaRespostaDto,
  ConciliacaoManualRespostaDto,
  DashboardFinanceiroRespostaDto,
  ExtratoImportarRespostaDto,
  ExtratoLoteListaDto,
  FluxoCaixaRespostaDto,
  PrevisibilidadeRespostaDto,
} from './dto/financeiro-conciliacao-response.dto';
import { PrismaService } from '../prisma/prisma.service';

function num(d: Prisma.Decimal | null | undefined): number {
  if (d === null || d === undefined) return 0;
  return Number(d.toFixed(2));
}

function hojeIsoBr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Injectable()
export class FinanceiroConciliacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly extratoStore: ExtratoStoreService,
  ) {}

  private margemMediaPct(): number {
    const v = parseFloat(this.config.get<string>('PLANEJAMENTO_MARGEM_MEDIA_PCT') ?? '22');
    return Number.isFinite(v) ? v : 22;
  }

  private elasticidadeProxy(): number {
    const v = parseFloat(this.config.get<string>('PLANEJAMENTO_ELASTICIDADE_PROXY') ?? '-0.35');
    return Number.isFinite(v) ? v : -0.35;
  }

  private custosFixosMensais(): number {
    const v = parseFloat(this.config.get<string>('FINANCEIRO_CUSTOS_FIXOS_MENSAL') ?? this.config.get<string>('CUSTOS_FIXOS_MENSAL') ?? '180000');
    return Number.isFinite(v) && v >= 0 ? v : 180000;
  }

  private saldoContaProxy(): number {
    const v = parseFloat(this.config.get<string>('FINANCEIRO_SALDO_CONTA_PROXY') ?? '0');
    return Number.isFinite(v) ? v : 0;
  }

  async importarExtrato(dto: ExtratoImportarDto): Promise<ExtratoImportarRespostaDto> {
    const batchId = randomUUID();
    const linhas =
      dto.formato === 'OFX'
        ? parseOfxExtrato(dto.conteudo, batchId)
        : parseCsvExtrato(dto.conteudo, batchId);

    this.extratoStore.salvarLote(batchId, linhas, dto.formato, dto.nomeOrigem);

    return {
      batchId,
      linhasImportadas: linhas.length,
      formato: dto.formato,
      nomeOrigem: dto.nomeOrigem,
    };
  }

  listarExtratos(batchId?: string): ExtratoLoteListaDto[] {
    const lotes = this.extratoStore.listarLotes();
    const filtro = batchId ? lotes.filter((l) => l.batchId === batchId) : lotes;
    return filtro.map((l) => ({
      batchId: l.batchId,
      formato: l.formato,
      importadoEm: l.importadoEm.toISOString(),
      linhasCount: l.linhas.length,
      nomeOrigem: l.nomeOrigem,
    }));
  }

  private async carregarBoletosConciliacao(): Promise<BoletoConciliacaoInput[]> {
    const rows = await this.prisma.boleto.findMany({
      select: {
        id: true,
        faturamentoId: true,
        numeroBoleto: true,
        valorBoleto: true,
        statusPagamento: true,
        dataVencimento: true,
      },
    });
    return rows.map((b) => ({
      id: b.id,
      faturamentoId: b.faturamentoId,
      numeroBoleto: b.numeroBoleto,
      valorBoleto: num(b.valorBoleto),
      statusPagamento: b.statusPagamento,
      dataVencimento: b.dataVencimento,
    }));
  }

  async getConciliacaoAutomatica(batchId?: string): Promise<ConciliacaoAutomaticaRespostaDto> {
    const linhas = this.extratoStore.todasLinhas(batchId);
    const boletos = await this.carregarBoletosConciliacao();
    const manual = this.extratoStore.getManualMap();
    const r = motorConciliacaoAutomatica(linhas, boletos, manual);

    return {
      conciliados: r.conciliados,
      pendentes: r.pendentes,
      suspeitos: r.suspeitos,
      divergentes: r.divergentes,
      boletosCarregados: boletos.length,
      linhasExtratoAnalisadas: linhas.length,
    };
  }

  async conciliacaoManual(
    dto: { extratoLinhaId: string; boletoId: string; faturamentoId: string },
    usuarioId: string,
  ): Promise<ConciliacaoManualRespostaDto> {
    this.extratoStore.registrarManual(dto.extratoLinhaId, dto.boletoId, dto.faturamentoId);

    await this.prisma.auditoria.create({
      data: {
        tabela: 'financeiro_conciliacao_manual',
        registroId: `${dto.extratoLinhaId}_${dto.boletoId}`,
        acao: AcaoAuditoria.INSERT,
        usuario: usuarioId,
        dadosDepois: {
          extratoLinhaId: dto.extratoLinhaId,
          boletoId: dto.boletoId,
          faturamentoId: dto.faturamentoId,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      ok: true,
      extratoLinhaId: dto.extratoLinhaId,
      boletoId: dto.boletoId,
      faturamentoId: dto.faturamentoId,
      auditoriaRegistrada: true,
    };
  }

  async getFluxoCaixa(horizonte: 7 | 30 | 90): Promise<FluxoCaixaRespostaDto> {
    const hoje = new Date();
    const fim = new Date(hoje);
    fim.setDate(fim.getDate() + horizonte);

    const iniDia = new Date(hoje);
    iniDia.setHours(0, 0, 0, 0);

    const boletosAbertos = await this.prisma.boleto.findMany({
      where: {
        statusPagamento: { in: [StatusPagamento.PENDENTE, StatusPagamento.VENCIDO] },
        dataVencimento: { gte: iniDia, lte: fim },
      },
      select: { valorBoleto: true },
    });

    const entradasEsperadas = boletosAbertos.reduce((s, b) => s + num(b.valorBoleto), 0);

    const saidasComprometidas = parseFloat(this.config.get<string>('FINANCEIRO_SAIDAS_COMPROMETIDAS_MES') ?? '0') || 0;

    const saldoIni = this.saldoContaProxy();
    const fluxo = projetarFluxoCaixa({
      horizonteDias: horizonte,
      saldoInicialProxy: saldoIni,
      entradasEsperadasPeriodo: entradasEsperadas * 0.65,
      custosFixosMensais: this.custosFixosMensais(),
      saidasComprometidasPeriodo: saidasComprometidas,
    });

    return {
      horizonte,
      saldoProjetadoFim: fluxo.saldoProjetadoFim,
      entradasPrevistas: fluxo.entradasPrevistas,
      saidasPrevistas: fluxo.saidasPrevistas,
      detalhe: {
        boletosAbertosNoHorizonte: boletosAbertos.length,
        taxaRecuperacaoProxy: 0.65,
        custosFixosMensais: this.custosFixosMensais(),
      },
    };
  }

  async getPrevisibilidade(): Promise<PrevisibilidadeRespostaDto> {
    const ini = new Date();
    ini.setFullYear(ini.getFullYear() - 4);
    ini.setDate(1);
    ini.setHours(0, 0, 0, 0);

    const [rowsFat, rowsDem] = await Promise.all([
      this.prisma.$queryRaw<Array<{ mes: string; v: Prisma.Decimal | null }>>`
        SELECT TO_CHAR("createdAt", 'YYYY-MM') AS mes, SUM("valorTotal") AS v
        FROM faturamentos
        WHERE "createdAt" >= ${ini}
        GROUP BY 1
        ORDER BY 1
      `,
      this.prisma.$queryRaw<Array<{ mes: string; n: bigint }>>`
        SELECT TO_CHAR(sa."dataHoraSaida", 'YYYY-MM') AS mes, COUNT(*)::bigint AS n
        FROM saidas sa
        JOIN solicitacoes s ON s.id = sa."solicitacaoId"
        WHERE s."deletedAt" IS NULL AND sa."dataHoraSaida" >= ${ini}
        GROUP BY 1 ORDER BY 1
      `,
    ]);

    const receitaHist: MesValor[] = rowsFat.map((r) => ({
      mes: r.mes,
      valor: num(r.v),
    }));

    const margem = this.margemMediaPct();
    const el = this.elasticidadeProxy();
    const fc = construirForecastFinanceiro(
      receitaHist.length >= 1 ? receitaHist : [{ mes: '2026-01', valor: 1 }],
      margem,
      el,
      4,
    );

    const demanda = projetarDemanda12Meses(
      rowsDem.length >= 1
        ? rowsDem.map((r) => ({ mes: r.mes, valor: Number(r.n) }))
        : [{ mes: '2026-01', valor: 1 }],
    );

    const n = Math.min(fc.mesAMes.length, demanda.volumePrevisto.length);
    const combinar = fc.mesAMes.slice(0, n).map((m, i) => ({
      mes: m.mes,
      valor:
        Math.round(((m.valor + (demanda.volumePrevisto[i]?.valor ?? 0)) / 2) * 100) / 100,
    }));

    const agg = agregarSerie12Meses(combinar, margem);

    const inadimplenciaHist = await this.calcularInadimplenciaPct();
    const inadProj = Math.min(95, Math.max(0, inadimplenciaHist * (1 + Math.abs(el) * 0.5)));

    return {
      previsaoReceita12Meses: agg.receita,
      previsaoMargem12Meses: agg.margem,
      previsaoCaixa12Meses: agg.caixa,
      cenarios: {
        pessimista: {
          receitaAnual: fc.pessimista.receitaTotal,
          margemAnual: fc.pessimista.margemTotal,
        },
        base: { receitaAnual: fc.base.receitaTotal, margemAnual: fc.base.margemTotal },
        otimista: {
          receitaAnual: fc.otimista.receitaTotal,
          margemAnual: fc.otimista.margemTotal,
        },
      },
      inadimplenciaProjetadaPct: Math.round(inadProj * 10) / 10,
      elasticidadeProxy: el,
    };
  }

  private async calcularInadimplenciaPct(): Promise<number> {
    const [emAberto, total] = await Promise.all([
      this.prisma.boleto.aggregate({
        where: {
          statusPagamento: { in: [StatusPagamento.VENCIDO, StatusPagamento.PENDENTE] },
        },
        _sum: { valorBoleto: true },
      }),
      this.prisma.boleto.aggregate({ _sum: { valorBoleto: true } }),
    ]);
    const vOpen = num(emAberto._sum.valorBoleto ?? undefined);
    const vTot = num(total._sum.valorBoleto ?? undefined);
    if (vTot <= 0) return 0;
    return Math.round((vOpen / vTot) * 1000) / 10;
  }

  async getDashboard(): Promise<DashboardFinanceiroRespostaDto> {
    const hojeStr = hojeIsoBr();
    const linhas = this.extratoStore.todasLinhas();
    let rec = 0;
    let pag = 0;
    for (const l of linhas) {
      if (!l.dataLancamento.startsWith(hojeStr.slice(0, 10))) continue;
      if (l.tipo === 'CREDITO') rec += l.valor;
      else pag += l.valor;
    }

    const conc = await this.getConciliacaoAutomatica();
    const inad = await this.calcularInadimplenciaPct();
    const prev = await this.getPrevisibilidade();

    const flux7 = await this.getFluxoCaixa(7);
    const flux30 = await this.getFluxoCaixa(30);

    const divergencias = (conc.divergentes as unknown[]).length + (conc.suspeitos as unknown[]).length;
    const saude = Math.max(
      0,
      Math.min(
        100,
        100 - inad * 1.2 - divergencias * 2 - (prev.inadimplenciaProjetadaPct ?? 0) * 0.5,
      ),
    );

    return {
      saldoAtual: this.saldoContaProxy(),
      recebimentosHoje: Math.round(rec * 100) / 100,
      pagamentosHoje: Math.round(pag * 100) / 100,
      saldoPrevisto7d: flux7.saldoProjetadoFim,
      saldoPrevisto30d: flux30.saldoProjetadoFim,
      inadimplenciaAtualPct: inad,
      inadimplenciaProjetadaPct: prev.inadimplenciaProjetadaPct,
      itensConciliados: (conc.conciliados as unknown[]).length,
      divergenciasBancarias: divergencias,
      indiceSaudeFinanceira: Math.round(saude * 10) / 10,
      observacaoExtratos:
        'Extratos normalizados ficam em memória no processo até existir tabela dedicada (sem migration nesta fase).',
    };
  }
}
