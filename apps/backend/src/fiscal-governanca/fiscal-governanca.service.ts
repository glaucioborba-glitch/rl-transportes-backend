import { Injectable } from '@nestjs/common';
import {
  AcaoAuditoria,
  Prisma,
  StatusPagamento,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { FiscalGovernancaQueryDto } from './dto/fiscal-governanca-query.dto';
import type {
  DivergenciaFiscalDto,
  EventoCriticoAuditoriaDto,
  FiscalAuditoriaInteligenteRespostaDto,
  FiscalConciliacaoRespostaDto,
  FiscalDashboardRespostaDto,
  FiscalNfseMonitorRespostaDto,
  FiscalSaneamentoSugeridoRespostaDto,
  NfseMonitorItemDto,
} from './dto/fiscal-governanca-response.dto';
import {
  construirDivergenciasFaturamento,
  divergenciasNotasDuplicadasPorNumero,
  type DivergenciaFiscal,
  type FatLinhaInput,
  indiceConfiabilidadeFiscalPct,
  nfsSemRetornoPrefeitura,
  nfsStatusCancelado,
  nfsStatusEmitidoOk,
  nfsStatusPendenteMunicipio,
  scoreRiscoFiscalPct,
  scoreRiscoOperacionalPct,
  saneamentoSugeridoDeDivergencias,
} from './fiscal-governanca.calculations';

function num(d: Prisma.Decimal | null | undefined): number {
  if (d === null || d === undefined) return 0;
  return Number(d.toFixed(2));
}

function diasOuPadrao(q?: FiscalGovernancaQueryDto): number {
  const d = q?.dias ?? 90;
  return Math.min(730, Math.max(1, d));
}

function unwrapAuditJson(j: unknown): Record<string, unknown> {
  if (j === null || j === undefined) return {};
  if (typeof j !== 'object') return {};
  const o = j as Record<string, unknown>;
  if ('record' in o && o.record !== undefined && typeof o.record === 'object') {
    return o.record as Record<string, unknown>;
  }
  return o;
}

function diffSensivel(
  antes: Record<string, unknown>,
  depois: Record<string, unknown>,
): string[] {
  const keys = [
    'valorTotal',
    'clienteId',
    'placaVeiculo',
    'cpfCnpj',
    'valor',
    'valorBoleto',
    'status',
  ];
  const hits: string[] = [];
  for (const k of keys) {
    if (k in antes || k in depois) {
      const a = JSON.stringify(antes[k] ?? null);
      const b = JSON.stringify(depois[k] ?? null);
      if (a !== b) hits.push(k);
    }
  }
  return hits;
}

@Injectable()
export class FiscalGovernancaService {
  constructor(private readonly prisma: PrismaService) {}

  private inicioUtc(dias: number): Date {
    const ini = new Date();
    ini.setDate(ini.getDate() - dias);
    ini.setHours(0, 0, 0, 0);
    return ini;
  }

  private async linhasFaturamentoParaConciliacao(
    ini: Date,
  ): Promise<{ linhas: FatLinhaInput[]; nfsFlat: Array<{ id: string; numeroNfe: string; faturamentoId: string }> }> {
    /** SELECT explícito: migração removeu `statusNfe` da tabela `faturamentos` enquanto o schema Prisma ainda pode referenciá-lo. */
    const fatRows = await this.prisma.$queryRaw<
      Array<{ id: string; valorTotal: Prisma.Decimal; createdAt: Date }>
    >`
      SELECT id, "valorTotal", "createdAt"
      FROM faturamentos
      WHERE "createdAt" >= ${ini}
    `;

    const ids = fatRows.map((r) => r.id);
    if (ids.length === 0) {
      return { linhas: [], nfsFlat: [] };
    }

    const [itens, boletos, nfsEmitidas, solRows] = await Promise.all([
      this.prisma.faturamentoItem.findMany({ where: { faturamentoId: { in: ids } } }),
      this.prisma.boleto.findMany({ where: { faturamentoId: { in: ids } } }),
      this.prisma.nfsEmitida.findMany({ where: { faturamentoId: { in: ids } } }),
      this.prisma.faturamentoSolicitacao.findMany({
        where: { faturamentoId: { in: ids } },
        select: { faturamentoId: true },
      }),
    ]);

    const itensPorFat = new Map<string, typeof itens>();
    const bolPorFat = new Map<string, typeof boletos>();
    const nfsPorFat = new Map<string, typeof nfsEmitidas>();
    for (const id of ids) {
      itensPorFat.set(id, []);
      bolPorFat.set(id, []);
      nfsPorFat.set(id, []);
    }
    for (const it of itens) {
      itensPorFat.get(it.faturamentoId)?.push(it);
    }
    for (const b of boletos) {
      bolPorFat.get(b.faturamentoId)?.push(b);
    }
    for (const n of nfsEmitidas) {
      nfsPorFat.get(n.faturamentoId)?.push(n);
    }

    const solPorFat = new Map<string, number>();
    for (const s of solRows) {
      solPorFat.set(s.faturamentoId, (solPorFat.get(s.faturamentoId) ?? 0) + 1);
    }

    const linhas: FatLinhaInput[] = fatRows.map((fat) => {
      const fi = itensPorFat.get(fat.id) ?? [];
      let soma = 0;
      let descVazia = false;
      let valorZero = false;
      for (const it of fi) {
        soma += num(it.valor);
        if (!String(it.descricao || '').trim()) descVazia = true;
        if (num(it.valor) <= 0) valorZero = true;
      }
      const nfsList = nfsPorFat.get(fat.id) ?? [];

      return {
        id: fat.id,
        valorTotal: num(fat.valorTotal),
        itensValorSoma: Math.round(soma * 100) / 100,
        nfsEmitidas: nfsList.map((n) => ({
          id: n.id,
          numeroNfe: n.numeroNfe,
          statusIpm: n.statusIpm,
          xmlNfe: n.xmlNfe ?? '',
          updatedAt: n.updatedAt,
        })),
        boletos: (bolPorFat.get(fat.id) ?? []).map((b) => ({
          id: b.id,
          valorBoleto: num(b.valorBoleto),
          statusPagamento: b.statusPagamento,
        })),
        solicitacoesCount: solPorFat.get(fat.id) ?? 0,
        itensDescricaoVazia: descVazia,
        itensValorZero: valorZero,
      };
    });

    const nfsFlat = nfsEmitidas.map((n) => ({
      id: n.id,
      numeroNfe: n.numeroNfe,
      faturamentoId: n.faturamentoId,
    }));

    return { linhas, nfsFlat };
  }

  private divergenciasConsolidadas(
    linhas: FatLinhaInput[],
    nfsFlat: Array<{ id: string; numeroNfe: string; faturamentoId: string }>,
  ): DivergenciaFiscal[] {
    const d1 = construirDivergenciasFaturamento(linhas);
    const d2 = divergenciasNotasDuplicadasPorNumero(nfsFlat);
    return [...d1, ...d2];
  }

  async getConciliacao(query?: FiscalGovernancaQueryDto): Promise<FiscalConciliacaoRespostaDto> {
    const dias = diasOuPadrao(query);
    const ini = this.inicioUtc(dias);
    const { linhas, nfsFlat } = await this.linhasFaturamentoParaConciliacao(ini);
    const divergencias = this.divergenciasConsolidadas(linhas, nfsFlat);

    let nfsEmitidasAnalisadas = 0;
    let boletosAnalisados = 0;
    for (const L of linhas) {
      nfsEmitidasAnalisadas += L.nfsEmitidas.length;
      boletosAnalisados += L.boletos.length;
    }

    return {
      divergencias: divergencias.map((d) => this.toDto(d)),
      faturamentosAnalisados: linhas.length,
      nfsEmitidasAnalisadas,
      boletosAnalisados,
      periodoDias: dias,
      dataInicioUtc: ini.toISOString(),
    };
  }

  private toDto(d: DivergenciaFiscal): DivergenciaFiscalDto {
    return {
      codigo: d.codigo,
      severidade: d.severidade,
      mensagem: d.mensagem,
      sugestaoCorrecao: d.sugestaoCorrecao,
      faturamentoId: d.faturamentoId,
      nfsEmitidaId: d.nfsEmitidaId,
      boletoId: d.boletoId,
      solicitacaoId: d.solicitacaoId,
      valorReferencia: d.valorReferencia,
      valorComparado: d.valorComparado,
      metadata: d.metadata,
    };
  }

  async getAuditoriaInteligente(
    query?: FiscalGovernancaQueryDto,
  ): Promise<FiscalAuditoriaInteligenteRespostaDto> {
    const dias = diasOuPadrao(query);
    const ini = this.inicioUtc(dias);

    const [concDiv, gateSemPortaria, saidaSemPatio, auditsUpdate, auditsSeg, offHoursRows] =
      await Promise.all([
        this.getConciliacao({ dias }),
        this.prisma.solicitacao.count({
          where: {
            deletedAt: null,
            portaria: null,
            gate: { isNot: null },
          },
        }),
        this.prisma.solicitacao.count({
          where: {
            deletedAt: null,
            patio: null,
            saida: { isNot: null },
          },
        }),
        this.prisma.auditoria.findMany({
          where: {
            createdAt: { gte: ini },
            acao: AcaoAuditoria.UPDATE,
            tabela: { in: ['faturamentos', 'clientes', 'solicitacoes', 'portarias', 'boletos'] },
          },
          take: 1200,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.auditoria.findMany({
          where: {
            createdAt: { gte: ini },
            acao: AcaoAuditoria.SEGURANCA,
          },
          take: 200,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.$queryRaw<Array<{ c: bigint }>>`
          SELECT COUNT(*)::bigint AS c
          FROM auditorias
          WHERE "createdAt" >= ${ini}
            AND acao::text IN ('INSERT', 'UPDATE')
            AND tabela IN ('portarias', 'gates', 'patios', 'saidas')
            AND (EXTRACT(HOUR FROM "createdAt") < 6 OR EXTRACT(HOUR FROM "createdAt") >= 22)
        `,
      ]);

    const eventos: EventoCriticoAuditoriaDto[] = [];

    if (gateSemPortaria > 0) {
      eventos.push({
        tipo: 'FLUXO_GATE_SEM_PORTARIA',
        severidade: 'ALTA',
        descricao: `${gateSemPortaria} solicitação(ões) com gate registrado sem portaria.`,
        metadata: { quantidade: gateSemPortaria },
      });
    }
    if (saidaSemPatio > 0) {
      eventos.push({
        tipo: 'FLUXO_SAIDA_SEM_PATIO',
        severidade: 'MEDIA',
        descricao: `${saidaSemPatio} solicitação(ões) com saída sem pátio.`,
        metadata: { quantidade: saidaSemPatio },
      });
    }

    const offH = Number(offHoursRows[0]?.c ?? 0);
    if (offH > 0) {
      eventos.push({
        tipo: 'PADRAO_HORARIO_ANOMALO',
        severidade: offH > 40 ? 'MEDIA' : 'BAIXA',
        descricao: `${offH} operações auditadas fora da faixa 06h–22h (proxy).`,
        metadata: { quantidade: offH },
      });
    }

    let manualLim = 0;
    for (const a of auditsUpdate) {
      const antes = unwrapAuditJson(a.dadosAntes);
      const depois = unwrapAuditJson(a.dadosDepois);
      const hits = diffSensivel(antes, depois);
      if (hits.length > 0 && manualLim < 55) {
        manualLim += 1;
        eventos.push({
          tipo: 'ALTERACAO_MANUAL_SENSIVEL',
          severidade: hits.some((h) => /valor|cliente|cpf/i.test(h)) ? 'ALTA' : 'MEDIA',
          descricao: `UPDATE em ${a.tabela}: campos alterados ${hits.join(', ')}.`,
          auditoriaId: a.id,
          registroId: a.registroId,
          tabela: a.tabela,
          metadata: { campos: hits },
        });
      }
    }

    for (const s of auditsSeg) {
      eventos.push({
        tipo: 'SEGURANCA_ESCOPO_OU_ACESSO',
        severidade: 'MEDIA',
        descricao: 'Evento SEGURANCA registrado na auditoria.',
        auditoriaId: s.id,
        registroId: s.registroId,
        tabela: s.tabela,
      });
    }

    const fluxosAnomalos = (gateSemPortaria > 0 ? 1 : 0) + (saidaSemPatio > 0 ? 1 : 0);
    const divAlta = concDiv.divergencias.filter((d) => d.severidade === 'ALTA').length;

    const scoreFiscal = scoreRiscoFiscalPct(concDiv.divergencias);
    const scoreOp = scoreRiscoOperacionalPct({
      eventosCriticos: eventos.filter((e) => e.severidade === 'ALTA').length + divAlta,
      fluxosAnomalos,
      segurancaEventos: auditsSeg.length,
    });

    return {
      eventosCriticos: eventos.slice(0, 150),
      scoreRiscoOperacional: scoreOp,
      scoreRiscoFiscal: scoreFiscal,
      observacaoHttpAuditoria:
        'Chamadas HTTP 401/403 não são armazenadas em `auditorias` por padrão; use eventos SEGURANCA ou logs de API para correlação.',
    };
  }

  async getNfseMonitor(query?: FiscalGovernancaQueryDto): Promise<FiscalNfseMonitorRespostaDto> {
    const dias = diasOuPadrao(query);
    const ini = this.inicioUtc(dias);
    const rows = await this.prisma.nfsEmitida.findMany({
      where: {
        OR: [{ createdAt: { gte: ini } }, { updatedAt: { gte: ini } }],
      },
      orderBy: { updatedAt: 'desc' },
      take: 2000,
    });

    const now = Date.now();
    const itens: NfseMonitorItemDto[] = [];
    let semRetorno = 0;
    let aguardandoRetry = 0;

    for (const n of rows) {
      const st = n.statusIpm || '';
      let bucket: NfseMonitorItemDto['bucket'] = 'OUTRO';
      if (nfsStatusEmitidoOk(st)) bucket = 'EMITIDO';
      else if (nfsStatusCancelado(st)) bucket = 'CANCELADO';
      else if (nfsStatusPendenteMunicipio(st)) bucket = 'PENDENTE_MUNICIPIO';

      const hours = (now - new Date(n.updatedAt).getTime()) / 3_600_000;
      const pendente = nfsStatusPendenteMunicipio(st);
      const alertaTravada = pendente && hours >= 24;
      const alertaFalha = /REJEIT|PENDENTE_CANCEL|ERRO/i.test(st);

      if (nfsSemRetornoPrefeitura(st)) semRetorno += 1;
      if (/REJEIT|PENDENTE_CANCEL/i.test(st)) aguardandoRetry += 1;

      itens.push({
        id: n.id,
        faturamentoId: n.faturamentoId,
        numeroNfe: n.numeroNfe,
        statusIpm: st,
        bucket,
        alertaTravada24h: alertaTravada,
        alertaFalhaPrefeitura: alertaFalha,
        horasDesdeAtualizacao: Math.round(hours * 10) / 10,
        updatedAt: n.updatedAt.toISOString(),
      });
    }

    return {
      itens,
      totalSemRetornoMunicipal: semRetorno,
      totalAguardandoReenvioOuRetry: aguardandoRetry,
      periodoDias: dias,
    };
  }

  async getDashboard(query?: FiscalGovernancaQueryDto): Promise<FiscalDashboardRespostaDto> {
    const dias = diasOuPadrao(query);
    const ini = this.inicioUtc(dias);

    const conc = await this.getConciliacao({ dias });

    const [aggFatRow, nfsRows, boletosVenc] = await Promise.all([
      this.prisma.$queryRaw<Array<{ s: Prisma.Decimal | null }>>`
        SELECT SUM("valorTotal") AS s FROM faturamentos WHERE "createdAt" >= ${ini}
      `,
      this.prisma.nfsEmitida.findMany({
        where: { createdAt: { gte: ini } },
        select: { statusIpm: true },
      }),
      this.prisma.boleto.count({
        where: {
          dataVencimento: { lt: new Date() },
          statusPagamento: {
            notIn: [StatusPagamento.PAGO, StatusPagamento.CANCELADO],
          },
        },
      }),
    ]);

    let nfEmitidas = 0;
    let nfPendentes = 0;
    for (const n of nfsRows) {
      if (nfsStatusEmitidoOk(n.statusIpm)) nfEmitidas += 1;
      else if (!nfsStatusCancelado(n.statusIpm)) nfPendentes += 1;
    }

    const riscoFiscal = scoreRiscoFiscalPct(conc.divergencias);

    const opEvt = await this.getAuditoriaInteligente({ dias });
    const riscoOp = opEvt.scoreRiscoOperacional;

    return {
      totalFaturadoPeriodo: num(aggFatRow[0]?.s ?? undefined),
      totalNfseEmitidas: nfEmitidas,
      totalNfsePendentes: nfPendentes,
      totalBoletosVencidos: boletosVenc,
      divergenciasAtivas: conc.divergencias.length,
      riscoFiscalPct: riscoFiscal,
      riscoOperacionalPct: riscoOp,
      indiceConfiabilidadeFiscal: indiceConfiabilidadeFiscalPct(riscoFiscal, riscoOp),
      periodoDias: dias,
      dataInicioUtc: ini.toISOString(),
    };
  }

  async getSaneamentoSugerido(query?: FiscalGovernancaQueryDto): Promise<FiscalSaneamentoSugeridoRespostaDto> {
    const conc = await this.getConciliacao(query);
    const extrasNfse: DivergenciaFiscal[] = [];

    const dias = diasOuPadrao(query);
    const ini = this.inicioUtc(dias);
    const nfs = await this.prisma.nfsEmitida.findMany({
      where: { updatedAt: { gte: ini } },
      select: { id: true, statusIpm: true, faturamentoId: true, updatedAt: true },
    });
    const now = Date.now();
    for (const n of nfs) {
      const h = (now - new Date(n.updatedAt).getTime()) / 3_600_000;
      if (nfsStatusPendenteMunicipio(n.statusIpm) && h >= 24) {
        extrasNfse.push({
          codigo: 'NFSE_PENDENTE_PREFEITURA_24H',
          severidade: 'MEDIA',
          mensagem: `NFS-e ${n.id} pendente há mais de 24h.`,
          sugestaoCorrecao: 'Reconsultar status no provedor municipal ou reenviar conforme manual fiscal.',
          nfsEmitidaId: n.id,
          faturamentoId: n.faturamentoId,
        });
      }
    }

    const todas: Array<Pick<DivergenciaFiscal, 'codigo' | 'severidade' | 'sugestaoCorrecao'>> = [
      ...conc.divergencias.map((d) => ({
        codigo: d.codigo,
        severidade: d.severidade,
        sugestaoCorrecao: d.sugestaoCorrecao,
      })),
      ...extrasNfse.map((e) => ({
        codigo: e.codigo,
        severidade: e.severidade,
        sugestaoCorrecao: e.sugestaoCorrecao,
      })),
    ];

    const sugestoes = saneamentoSugeridoDeDivergencias(todas);

    return {
      sugestoes,
      total: sugestoes.length,
      observacao:
        'Diagnóstico somente leitura; nenhuma emissão ou cancelamento é executado por este endpoint.',
    };
  }
}
