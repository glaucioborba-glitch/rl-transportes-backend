import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, StatusIpm, StatusPagamento, StatusSolicitacao } from '@prisma/client';
import {
  areasCriticasDeIncidentes,
  calcularIndicesCertificacao,
  calcularScoreCompliance,
  listarGapsCertificacao,
  mapaRiscoCorporativoPorSeveridade,
  mediaEficaciaControles,
  plano5w2hSugeridoParaGaps,
  recomendacoesPorIncidentes,
  severidadeRisco,
  type IncidenteComplianceCalc,
} from './grc-compliance.calculations';
import type {
  AuditoriaInteligenteRespostaDto,
  ControleGrcRespostaDto,
  DashboardGrcDto,
  GapAnalysisCertificacaoDto,
  IncidenteComplianceDto,
  PlanoAcaoGrcRespostaDto,
  RiscoGrcRespostaDto,
} from './dto/grc-compliance-response.dto';
import type {
  CreateControleGrcDto,
  CreatePlanoAcaoGrcDto,
  CreateRiscoGrcDto,
} from './dto/grc-compliance.dto';
import { GrcComplianceStoreService } from './grc-compliance-store.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GrcComplianceService {
  private readonly logger = new Logger(GrcComplianceService.name);

  constructor(
    private readonly store: GrcComplianceStoreService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  createRisco(dto: CreateRiscoGrcDto): RiscoGrcRespostaDto {
    const e = this.store.createRisco({
      titulo: dto.titulo.trim(),
      descricao: dto.descricao.trim(),
      categoria: dto.categoria,
      probabilidade: dto.probabilidade,
      impacto: dto.impacto,
      severidade: severidadeRisco(dto.probabilidade, dto.impacto),
      status: dto.status,
      responsavel: dto.responsavel.trim(),
      origem: dto.origem,
    });
    return { ...e };
  }

  listRiscos(): RiscoGrcRespostaDto[] {
    return this.store.listRiscos().map((r) => ({ ...r }));
  }

  createControle(dto: CreateControleGrcDto): ControleGrcRespostaDto {
    this.store.assertRiscoExists(dto.riscoRelacionadoId);
    const e = this.store.createControle({
      nomeControle: dto.nomeControle.trim(),
      riscoRelacionadoId: dto.riscoRelacionadoId,
      frequencia: dto.frequencia,
      responsavel: dto.responsavel.trim(),
      evidencia: dto.evidencia?.trim(),
      eficacia: dto.eficacia,
    });
    return { ...e };
  }

  listControles(): ControleGrcRespostaDto[] {
    return this.store.listControles().map((c) => ({ ...c }));
  }

  createPlano(dto: CreatePlanoAcaoGrcDto): PlanoAcaoGrcRespostaDto {
    const e = this.store.createPlano({
      what: dto.what.trim(),
      why: dto.why.trim(),
      where: dto.where.trim(),
      when: dto.when.trim(),
      who: dto.who.trim(),
      how: dto.how.trim(),
      howMuch: dto.howMuch,
      status: dto.status,
    });
    return { ...e };
  }

  listPlanos(): PlanoAcaoGrcRespostaDto[] {
    return this.store.listPlanos().map((p) => ({ ...p }));
  }

  /** Somente leitura no banco; se o schema local divergir do deploy (ex.: migração pendente), retorna lista vazia. */
  private async coletarIncidentesReadOnly(): Promise<IncidenteComplianceCalc[]> {
    try {
      return await this.coletarIncidentesReadOnlyCore();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2022') {
        this.logger.warn(
          `GRC compliance engine: leitura Prisma omitida (coluna/tabela ausente no banco). ${e.message}`,
        );
        return [];
      }
      throw e;
    }
  }

  private async coletarIncidentesReadOnlyCore(): Promise<IncidenteComplianceCalc[]> {
    const out: IncidenteComplianceCalc[] = [];

    const nfPend = await this.prisma.faturamento.count({
      where: { statusNfe: 'pendente' },
    });
    if (nfPend > 0) {
      out.push({
        codigo: 'FIN-NF-PEND',
        severidade: nfPend > 8 ? 'alta' : 'media',
        area: 'Fiscal',
        descricao: `${nfPend} faturamento(es) com NFS-e pendente.`,
        fonteDados: 'Prisma:faturamentos.statusNfe',
      });
    }

    const boVenc = await this.prisma.boleto.count({
      where: { statusPagamento: StatusPagamento.VENCIDO },
    });
    if (boVenc > 0) {
      out.push({
        codigo: 'FIN-BOLETO-VENC',
        severidade: boVenc > 5 ? 'alta' : 'media',
        area: 'Financeiro',
        descricao: `${boVenc} boleto(s) com status VENCIDO.`,
        fonteDados: 'Prisma:boletos.statusPagamento',
      });
    }

    const nfsRej = await this.prisma.nfsEmitida.count({
      where: { statusIpm: StatusIpm.REJEITADO },
    });
    if (nfsRej > 0) {
      out.push({
        codigo: 'FISC-NFS-REJ',
        severidade: nfsRej > 3 ? 'alta' : 'media',
        area: 'Fiscal',
        descricao: `${nfsRej} NFS-e com status IPM REJEITADO.`,
        fonteDados: 'Prisma:nfs_emitidas.statusIpm',
      });
    }

    const gateSemRic = await this.prisma.gate.count({
      where: {
        ricAssinado: false,
        solicitacao: { status: StatusSolicitacao.CONCLUIDO, deletedAt: null },
      },
    });
    if (gateSemRic > 0) {
      out.push({
        codigo: 'OPS-GATE-RIC',
        severidade: gateSemRic > 2 ? 'alta' : 'media',
        area: 'Operacional',
        descricao: `${gateSemRic} solicitação(ões) concluída(s) com RIC não assinado no Gate.`,
        fonteDados: 'Prisma:gates.ricAssinado+solicitacao.status',
      });
    }

    const limOcr = parseInt(this.config.get<string>('GRC_OCR_BACKLOG_THRESHOLD') ?? '25', 10) || 25;
    const ocrPend = await this.prisma.portaria.count({ where: { statusOcr: 'pendente' } });
    if (ocrPend >= limOcr) {
      out.push({
        codigo: 'OPS-OCR-BACKLOG',
        severidade: ocrPend > limOcr * 2 ? 'critica' : 'alta',
        area: 'Operacional',
        descricao: `Backlog OCR portaria: ${ocrPend} registro(s) pendente(s) (limiar ${limOcr}).`,
        fonteDados: 'Prisma:portarias.statusOcr',
      });
    }

    const auditFin = await this.prisma.auditoria.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
        tabela: { in: ['faturamentos', 'boletos'] },
      },
    });
    if (auditFin > 50) {
      out.push({
        codigo: 'AUD-FIN-VOL',
        severidade: 'baixa',
        area: 'Auditoria',
        descricao: `${auditFin} eventos de auditoria ligados a faturamento/boletos em 30 dias (volume).`,
        fonteDados: 'Prisma:auditorias',
      });
    }

    const ausRh = parseFloat(this.config.get<string>('GRC_RH_AUSENCIAS_PROXY') ?? '0') || 0;
    if (ausRh >= 5) {
      out.push({
        codigo: 'RH-AUS-PROXY',
        severidade: ausRh >= 12 ? 'alta' : 'media',
        area: 'RH',
        descricao: `Ausências recorrentes proxy (${ausRh}) — integrar folha-rh quando disponível.`,
        fonteDados: 'env:GRC_RH_AUSENCIAS_PROXY',
      });
    }

    const seg = parseFloat(this.config.get<string>('GRC_INCIDENTES_SEGURANCA_PROXY') ?? '0') || 0;
    if (seg >= 1) {
      out.push({
        codigo: 'SEG-INC-PROXY',
        severidade: seg >= 4 ? 'critica' : 'alta',
        area: 'Segurança patrimonial',
        descricao: `Incidentes de segurança proxy (${seg}) — monitorar ISPS/perímetro.`,
        fonteDados: 'env:GRC_INCIDENTES_SEGURANCA_PROXY',
      });
    }

    return out;
  }

  private paraAuditoriaDto(incidentesCalc: IncidenteComplianceCalc[]): AuditoriaInteligenteRespostaDto {
    const scoreCompliance = calcularScoreCompliance(incidentesCalc);
    const areasCriticas = areasCriticasDeIncidentes(incidentesCalc);
    const recomendacoes = recomendacoesPorIncidentes(incidentesCalc);
    const incidentes: IncidenteComplianceDto[] = incidentesCalc.map((i) => ({
      codigo: i.codigo,
      severidade: i.severidade,
      area: i.area,
      descricao: i.descricao,
      fonteDados: i.fonteDados,
    }));
    return { incidentes, scoreCompliance, areasCriticas, recomendacoes };
  }

  async getAuditoriaInteligente(): Promise<AuditoriaInteligenteRespostaDto> {
    const incidentesCalc = await this.coletarIncidentesReadOnly();
    return this.paraAuditoriaDto(incidentesCalc);
  }

  private eficaciaMediaControles(): number {
    const ctr = this.store.listControles();
    const med = mediaEficaciaControles(ctr.map((c) => c.eficacia));
    if (med !== null) return med;
    return this.numEnv('GRC_EFICACIA_CONTROLE_DEFAULT', 72);
  }

  private pctRiscosTratados(): number {
    const r = this.store.listRiscos();
    if (r.length === 0) return 85;
    const ok = r.filter((x) => x.status === 'mitigando' || x.status === 'controlado').length;
    return Math.round((ok / r.length) * 10000) / 100;
  }

  private numEnv(k: string, d: number): number {
    const v = parseFloat(this.config.get<string>(k) ?? '');
    return Number.isFinite(v) ? v : d;
  }

  private montarGapAnalysis(scoreCompliance: number): GapAnalysisCertificacaoDto {
    const { indiceAderenciaISO, indiceAderenciaOEA, indiceAderenciaISPS } = calcularIndicesCertificacao({
      eficaciaMediaControles: this.eficaciaMediaControles(),
      scoreCompliance,
      pctRiscosMitigadosOuControlados: this.pctRiscosTratados(),
    });
    const gaps = listarGapsCertificacao({
      indiceAderenciaISO,
      indiceAderenciaOEA,
      indiceAderenciaISPS,
    });
    const idxs = [
      { nome: 'ISO 9001', v: indiceAderenciaISO },
      { nome: 'OEA', v: indiceAderenciaOEA },
      { nome: 'ISPS', v: indiceAderenciaISPS },
    ].sort((a, b) => a.v - b.v)[0];
    const plano = plano5w2hSugeridoParaGaps(idxs?.nome ?? 'ISO 9001');
    plano.howMuch = this.numEnv('GRC_PLANO_ACAO_CUSTO_ESTIMADO', 0);
    return {
      indiceAderenciaISO,
      indiceAderenciaOEA,
      indiceAderenciaISPS,
      gaps,
      planoAcaoSugerido: plano,
    };
  }

  async getGapAnalysis(): Promise<GapAnalysisCertificacaoDto> {
    const incidentesCalc = await this.coletarIncidentesReadOnly();
    const scoreCompliance = calcularScoreCompliance(incidentesCalc);
    return this.montarGapAnalysis(scoreCompliance);
  }

  async getDashboard(): Promise<DashboardGrcDto> {
    const riscos = this.store.listRiscos();
    const mapaSeveridade = mapaRiscoCorporativoPorSeveridade(riscos.map((r) => r.severidade));

    const ctr = this.store.listControles();
    const ctrBuckets: Record<string, number> = { '0-25': 0, '26-50': 0, '51-75': 0, '76-100': 0 };
    for (const c of ctr) {
      const e = c.eficacia;
      if (e <= 25) ctrBuckets['0-25'] += 1;
      else if (e <= 50) ctrBuckets['26-50'] += 1;
      else if (e <= 75) ctrBuckets['51-75'] += 1;
      else ctrBuckets['76-100'] += 1;
    }

    const incidentesCalc = await this.coletarIncidentesReadOnly();
    const ai = this.paraAuditoriaDto(incidentesCalc);
    const ga = this.montarGapAnalysis(ai.scoreCompliance);

    const incidentesPorArea: Record<string, number> = {};
    for (const i of ai.incidentes) {
      incidentesPorArea[i.area] = (incidentesPorArea[i.area] ?? 0) + 1;
    }

    const planos = this.store.listPlanos();
    const planosAtivos = planos.filter((p) => p.status !== 'concluido').length;
    const planosConcluidos = planos.filter((p) => p.status === 'concluido').length;

    return {
      riscosPorSeveridade: mapaSeveridade,
      controlesPorEficacia: ctrBuckets,
      scoreCompliance: ai.scoreCompliance,
      aderenciaISO: ga.indiceAderenciaISO,
      aderenciaOEA: ga.indiceAderenciaOEA,
      aderenciaISPS: ga.indiceAderenciaISPS,
      incidentesPorArea,
      planosAtivos,
      planosConcluidos,
      mapaRiscoCorporativo: mapaSeveridade,
    };
  }
}
