import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AcaoAuditoria,
  ModalidadeTransporte,
  PatioStatus,
  Prisma,
  Role,
  StatusSolicitacao,
  StatusContainer,
  TipoCaminhao,
  TipoOperacaoAgendamento,
  TipoOperacaoSolicitacaoIntent,
  TurnoAgendamento,
} from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { normalizeContainerIso, normalizeCpfDigits, normalizePlate, stripContainerIsoCanonical } from '../common/utils/data-sanitize';
import { isValidPlacaMercosulExtended } from '../common/utils/mercosul';
import { pipelineOcrGateMock } from '../ia-operacional/ia-operacional.ocr-mock';
import { PdfOperacionalV2Service } from '../pdf-operacional-v2/pdf-operacional-v2.service';
import { SecurityEventsService } from '../security-center/security-events.service';
import { SolicitacaoAnexoStorageService } from '../modules/solicitacoes-v2/solicitacao-anexo.storage';
import { SolicitacoesV2Service } from '../modules/solicitacoes-v2/solicitacoes-v2.service';
import { PatioV2Service } from '../patio-v2/patio.service';
import { ArmazenagemBillingService } from '../armazenagem-faturamento/armazenagem-billing.service';
import { YardAllocationService } from '../yard-allocation/yard-allocation.service';
import { PrismaService } from '../prisma/prisma.service';
import { VistoriaService, type VistoriaPhotoUpload } from '../vistoria/vistoria.service';
import { HoldReleaseService } from '../hold-release/hold-release.service';
import { AnguloFotoVistoria, TipoVistoria } from '@prisma/client';
import { extractPessoaResponsavelFromAudit } from '../pessoas-autorizadas/pessoa-context.util';
import type { GateCheckInDto } from './dto/gate-checkin.dto';
import type { GateCheckOutDto } from './dto/gate-checkout.dto';
import type { GateDivergenciaItemDto, GateDivergenciaTipo } from './dto/gate-divergencia.dto';

const CRITICAL_DIV: GateDivergenciaTipo[] = [
  'PLACA_DIVERGENTE',
  'LACRE_DIVERGENTE',
  'CONTAINER_TROCADO',
];

function assertPlate(label: string, raw: string): string {
  const n = normalizePlate(raw);
  if (!isValidPlacaMercosulExtended(n)) {
    throw new BadRequestException(`${label}: placa inválida`);
  }
  return n;
}

@Injectable()
export class GateV2Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly pdf: PdfOperacionalV2Service,
    private readonly storage: SolicitacaoAnexoStorageService,
    private readonly securityEvents: SecurityEventsService,
    private readonly solicitacoesV2: SolicitacoesV2Service,
    private readonly patioV2: PatioV2Service,
    private readonly armazenagemBilling: ArmazenagemBillingService,
    private readonly yardAllocation: YardAllocationService,
    private readonly vistoria: VistoriaService,
    private readonly holdRelease: HoldReleaseService,
  ) {}

  private hasCritical(divs: GateDivergenciaItemDto[]): boolean {
    return divs.some((d) => CRITICAL_DIV.includes(d.tipo as GateDivergenciaTipo));
  }

  private async resolvePessoaResponsavelSolicitacao(solicitacaoId: string) {
    const row = await this.prisma.auditoria.findFirst({
      where: {
        tabela: 'solicitacoes',
        acao: AcaoAuditoria.INSERT,
        registroId: solicitacaoId,
      },
      orderBy: { createdAt: 'asc' },
      select: { dadosDepois: true },
    });
    if (!row?.dadosDepois) return null;
    return extractPessoaResponsavelFromAudit(row.dadosDepois);
  }

  private mergeDivergencias(
    auto: GateDivergenciaItemDto[],
    manual: GateDivergenciaItemDto[] | undefined,
  ): GateDivergenciaItemDto[] {
    const key = (d: GateDivergenciaItemDto) => `${d.tipo}:${d.antes ?? ''}:${d.depois ?? ''}`;
    const seen = new Set<string>();
    const out: GateDivergenciaItemDto[] = [];
    for (const d of [...auto, ...(manual ?? [])]) {
      const k = key(d);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(d);
    }
    return out;
  }

  private detectAutoDivergencias(
    ts: {
      placaCavalo: string;
      placaCarreta01: string;
      placaCarreta02: string | null;
      nomeMotorista: string;
      cpfMotorista: string;
      tipoCaminhao: TipoCaminhao;
    },
    dto: GateCheckInDto,
    containers: { ordem: number; unidade: string }[],
  ): GateDivergenciaItemDto[] {
    const out: GateDivergenciaItemDto[] = [];
    const pCav = assertPlate('Placa cavalo (informada)', dto.placaCavalo);
    const p01 = assertPlate('Placa carreta 01', dto.placaCarreta01);
    const p02 =
      ts.tipoCaminhao === TipoCaminhao.RODOTREM && dto.placaCarreta02?.trim()
        ? assertPlate('Placa carreta 02', dto.placaCarreta02)
        : dto.placaCarreta02?.trim()
          ? assertPlate('Placa carreta 02', dto.placaCarreta02)
          : null;

    if (normalizePlate(ts.placaCavalo) !== pCav) {
      out.push({
        tipo: 'PLACA_DIVERGENTE',
        antes: normalizePlate(ts.placaCavalo),
        depois: pCav,
      });
    }
    if (normalizePlate(ts.placaCarreta01) !== p01) {
      out.push({
        tipo: 'PLACA_DIVERGENTE',
        antes: `carreta01:${normalizePlate(ts.placaCarreta01)}`,
        depois: p01,
      });
    }
    if (ts.placaCarreta02 && p02 && normalizePlate(ts.placaCarreta02) !== p02) {
      out.push({
        tipo: 'PLACA_DIVERGENTE',
        antes: `carreta02:${normalizePlate(ts.placaCarreta02)}`,
        depois: p02,
      });
    }

    const cpfCad = normalizeCpfDigits(ts.cpfMotorista);
    const cpfInf = normalizeCpfDigits(dto.motoristaCpf);
    if (cpfCad !== cpfInf) {
      out.push({ tipo: 'OUTRA', antes: `cpf_cadastro:${cpfCad}`, depois: `cpf_gate:${cpfInf}` });
    }
    if (ts.nomeMotorista.trim().toUpperCase() !== dto.motoristaNome.trim().toUpperCase()) {
      out.push({
        tipo: 'OUTRA',
        antes: `motorista:${ts.nomeMotorista}`,
        depois: dto.motoristaNome,
      });
    }

    /** Container ISO divergente (ordem) — gate confere unidade informada na solicitação. */
    const sorted = [...containers].sort((a, b) => a.ordem - b.ordem);
    for (const c of sorted) {
      const expected = normalizeContainerIso(c.unidade).replace(/\s/g, '').toUpperCase();
      /* sem leitura física por container neste MVP — operador declara via divergência manual */
      void expected;
    }

    return out;
  }

  async preCheckInContext(solicitacaoId: string, pdfHash?: string) {
    const detalhe = await this.solicitacoesV2.obterDetalheStaff(solicitacaoId);
    if (!detalhe) throw new NotFoundException('Solicitação v2 não encontrada');

    let verificacaoPdf = null as Awaited<ReturnType<PdfOperacionalV2Service['verificarAuthenticidade']>> | null;
    if (pdfHash?.trim()) {
      verificacaoPdf = await this.pdf.verificarAuthenticidade(solicitacaoId, pdfHash.trim());
    }

    const s = detalhe.solicitacao;
    const ts = s.transporteSolicitacao;
    if (!ts) throw new BadRequestException('Sem transporte v2');

    const openIn = await this.prisma.gateCheckIn.findFirst({
      where: { solicitacaoId, checkOut: null },
    });
    if (openIn) throw new ConflictException('Já existe check-in aberto para esta solicitação');

    const dtoProbe: GateCheckInDto = {
      placaCavalo: ts.placaCavalo,
      placaCarreta01: ts.placaCarreta01,
      placaCarreta02: ts.placaCarreta02 ?? undefined,
      motoristaNome: ts.nomeMotorista,
      motoristaCpf: ts.cpfMotorista,
    };
    const auto = this.detectAutoDivergencias(ts, dtoProbe, s.containersSolicitacao);

    return {
      solicitacaoId,
      protocolo: s.protocolo,
      status: s.status,
      giroEstimado: s.giroEstimado ?? null,
      pdf: verificacaoPdf,
      transporte: ts,
      containers: s.containersSolicitacao,
      agendamento: s.agendamentoSolicitacao,
      anexos: s.anexosSolicitacao,
      divergenciasAutomaticas: auto,
      autenticidade: {
        hashInformado: pdfHash ?? null,
        valido: verificacaoPdf?.valido ?? null,
        divergencias: verificacaoPdf?.divergencias ?? [],
      },
    };
  }

  async checkIn(
    solicitacaoId: string,
    operadorId: string,
    dto: GateCheckInDto,
    fotosVistoria: Map<AnguloFotoVistoria, VistoriaPhotoUpload>,
    opts?: { skipPdfHash?: boolean },
  ) {
    this.vistoria.assertFotosCompletas(fotosVistoria);

    const sol = await this.prisma.solicitacao.findFirst({
      where: { id: solicitacaoId, deletedAt: null, transporteSolicitacao: { isNot: null } },
      include: {
        transporteSolicitacao: true,
        containersSolicitacao: { orderBy: { ordem: 'asc' } },
      },
    });
    if (!sol?.transporteSolicitacao) throw new NotFoundException('Solicitação v2 não encontrada');

    const allowed: StatusSolicitacao[] = [
      StatusSolicitacao.AGUARDANDO_GATE_IN,
      StatusSolicitacao.APROVADO,
      StatusSolicitacao.EM_EXECUCAO,
    ];
    if (!allowed.includes(sol.status)) {
      throw new BadRequestException(
        `Status não permite check-in (${sol.status}). Aguardando liberação ou já processado.`,
      );
    }

    const pessoaResponsavel = await this.resolvePessoaResponsavelSolicitacao(solicitacaoId);

    const open = await this.prisma.gateCheckIn.findFirst({
      where: { solicitacaoId, checkOut: null },
    });
    if (open) throw new ConflictException('Check-in já em aberto');

    if (dto.pdfHash?.trim() && !opts?.skipPdfHash) {
      const v = await this.pdf.verificarAuthenticidade(solicitacaoId, dto.pdfHash.trim());
      if (!v.valido) {
        throw new UnprocessableEntityException({
          message: 'PDF / hash não confere com estado atual da solicitação',
          divergencias: v.divergencias,
        });
      }
    }

    const ts = sol.transporteSolicitacao;
    const auto = this.detectAutoDivergencias(ts, dto, sol.containersSolicitacao);
    const divergencias = this.mergeDivergencias(auto, dto.divergenciasOperador);

    const pCav = assertPlate('Placa cavalo', dto.placaCavalo);
    const p01 = assertPlate('Placa carreta 01', dto.placaCarreta01);
    let p02: string | null = null;
    if (ts.tipoCaminhao === TipoCaminhao.RODOTREM) {
      if (!dto.placaCarreta02?.trim()) {
        throw new BadRequestException('Placa carreta 02 obrigatória para Rodotrem');
      }
      p02 = assertPlate('Placa carreta 02', dto.placaCarreta02);
    } else if (dto.placaCarreta02?.trim()) {
      p02 = assertPlate('Placa carreta 02', dto.placaCarreta02);
    }

    let row;
    let vistoriaStorageKeys: string[] = [];
    try {
      row = await this.prisma.$transaction(async (tx) => {
        const gi = await tx.gateCheckIn.create({
          data: {
            solicitacaoId,
            operadorId,
            placaCavalo: pCav,
            placaCarreta01: p01,
            placaCarreta02: p02,
            motoristaNome: dto.motoristaNome.trim(),
            motoristaCpf: normalizeCpfDigits(dto.motoristaCpf),
            fotosEntrada: [] as unknown as Prisma.InputJsonValue,
            divergenciasJson: divergencias as unknown as Prisma.InputJsonValue,
            pdfHashValidado: dto.pdfHash?.trim() ?? null,
          },
        });

        const vist = await this.vistoria.createVistoria(tx, {
          solicitacaoId,
          tipo: TipoVistoria.GATE_IN,
          gateCheckInId: gi.id,
          avarias: dto.avarias,
          fotos: fotosVistoria,
        });
        vistoriaStorageKeys = vist.fotos
          .map((f) => f.storageKey)
          .filter((k): k is string => Boolean(k));

        await tx.gateCheckIn.update({
          where: { id: gi.id },
          data: { fotosEntrada: vist.publicUrls as unknown as Prisma.InputJsonValue },
        });

        await tx.solicitacao.update({
          where: { id: solicitacaoId },
          data: { status: StatusSolicitacao.EM_PATIO },
        });
        await this.auditoria.registrar(
          {
            tabela: 'gate_v2_check_ins',
            registroId: gi.id,
            acao: AcaoAuditoria.INSERT,
            usuario: operadorId,
            solicitacaoId,
            dadosDepois: {
              gateCheckInId: gi.id,
              divergencias,
              fotosCount: vist.publicUrls.length,
              avarias: dto.avarias ?? [],
              ...(pessoaResponsavel ? { pessoaResponsavel } : {}),
            },
          },
          tx,
        );
        await this.patioV2.provisionFromGateIn(gi.id, solicitacaoId, tx);
        await this.yardAllocation.applyGiroEstimado(solicitacaoId, {
          referenceAt: gi.dataHora,
          tx,
        });
        await this.armazenagemBilling.openPreFaturasForGateIn(
          gi.id,
          sol.clienteId,
          gi.dataHora,
          tx,
        );
        return gi;
      });
    } catch (err) {
      if (vistoriaStorageKeys.length) {
        await this.vistoria.rollbackUploaded(vistoriaStorageKeys);
      }
      throw err;
    }

    this.securityEvents.emit({
      type: 'CRITICAL_EVENT',
      tipo: pessoaResponsavel ? 'GATE_CHECKIN_PESSOA' : 'GATE_CHECKIN',
      userId: operadorId,
      solicitacaoId,
      contexto: {
        gateInId: row.id,
        divergencias,
        ...(pessoaResponsavel ? { pessoaResponsavel } : {}),
      } as Record<string, unknown>,
    });

    if (this.hasCritical(divergencias)) {
      this.securityEvents.emit({
        type: 'CRITICAL_EVENT',
        tipo: 'GATE_DIVERGENCIA_CRITICA',
        userId: operadorId,
        solicitacaoId,
        contexto: { gateInId: row.id, divergencias } as Record<string, unknown>,
      });
    }

    return row;
  }

  async preCheckOutContext(gateInId: string) {
    const gi = await this.prisma.gateCheckIn.findFirst({
      where: { id: gateInId },
      include: {
        checkOut: true,
        solicitacao: {
          include: {
            cliente: { select: { id: true, razaoSocial: true, cpfCnpj: true } },
            transporteSolicitacao: true,
            containersSolicitacao: { orderBy: { ordem: 'asc' } },
            agendamentoSolicitacao: true,
          },
        },
      },
    });
    if (!gi) throw new NotFoundException('Check-in não encontrado');
    if (gi.checkOut) throw new ConflictException('Check-out já registrado');

    const detalhe = await this.solicitacoesV2.obterDetalheStaff(gi.solicitacaoId);
    return {
      gateIn: gi,
      solicitacao: detalhe?.solicitacao ?? gi.solicitacao,
      timeline: detalhe?.timeline ?? [],
      divergenciasCheckIn: gi.divergenciasJson,
    };
  }

  async checkOut(
    gateInId: string,
    operadorId: string,
    dto: GateCheckOutDto,
    fotosVistoria: Map<AnguloFotoVistoria, VistoriaPhotoUpload>,
  ) {
    this.vistoria.assertFotosCompletas(fotosVistoria);

    const gi = await this.prisma.gateCheckIn.findFirst({
      where: { id: gateInId },
      include: { checkOut: true, solicitacao: true },
    });
    if (!gi) throw new NotFoundException('Check-in não encontrado');
    if (gi.checkOut) throw new ConflictException('Check-out já registrado');
    if (
      gi.solicitacao.status !== StatusSolicitacao.EM_PATIO &&
      gi.solicitacao.status !== StatusSolicitacao.AGUARDANDO_GATE_OUT
    ) {
      throw new BadRequestException(
        'Solicitação precisa estar EM_PATIO ou AGUARDANDO_GATE_OUT para check-out',
      );
    }

    const pessoaResponsavel = await this.resolvePessoaResponsavelSolicitacao(gi.solicitacaoId);

    const divergencias = this.mergeDivergencias([], dto.divergenciasOperador);

    const now = new Date();
    let vistoriaStorageKeys: string[] = [];
    try {
      await this.prisma.$transaction(async (tx) => {
        const co = await tx.gateCheckOut.create({
          data: {
            gateInId,
            operadorId,
            fotosSaida: [] as unknown as Prisma.InputJsonValue,
            divergenciasJson: divergencias as unknown as Prisma.InputJsonValue,
          },
        });

        const vist = await this.vistoria.createVistoria(tx, {
          solicitacaoId: gi.solicitacaoId,
          tipo: TipoVistoria.GATE_OUT,
          gateCheckInId: gi.id,
          gateCheckOutId: co.id,
          avarias: dto.avarias,
          fotos: fotosVistoria,
        });
        vistoriaStorageKeys = vist.fotos
          .map((f) => f.storageKey)
          .filter((k): k is string => Boolean(k));

        await tx.gateCheckOut.update({
          where: { id: co.id },
          data: { fotosSaida: vist.publicUrls as unknown as Prisma.InputJsonValue },
        });

        await tx.solicitacao.update({
          where: { id: gi.solicitacaoId },
          data: { status: StatusSolicitacao.CONCLUIDO },
        });
        await tx.saida.upsert({
          where: { solicitacaoId: gi.solicitacaoId },
          create: { solicitacaoId: gi.solicitacaoId, dataHoraSaida: now },
          update: { dataHoraSaida: now },
        });
        await this.auditoria.registrar(
          {
            tabela: 'gate_v2_check_outs',
            registroId: co.id,
            acao: AcaoAuditoria.INSERT,
            usuario: operadorId,
            solicitacaoId: gi.solicitacaoId,
            dadosDepois: {
              gateInId,
              gateOutId: co.id,
              divergencias,
              fotosCount: vist.publicUrls.length,
              avarias: dto.avarias ?? [],
              ...(pessoaResponsavel ? { pessoaResponsavel } : {}),
            },
          },
          tx,
        );
        await this.patioV2.finalizeFromGateOut(gateInId, operadorId, tx);
        await this.armazenagemBilling.consolidateOnGateOut(gateInId, now, tx);
      });
    } catch (err) {
      if (vistoriaStorageKeys.length) {
        await this.vistoria.rollbackUploaded(vistoriaStorageKeys);
      }
      throw err;
    }

    this.securityEvents.emit({
      type: 'CRITICAL_EVENT',
      tipo: pessoaResponsavel ? 'GATE_CHECKOUT_PESSOA' : 'GATE_CHECKOUT',
      userId: operadorId,
      solicitacaoId: gi.solicitacaoId,
      contexto: {
        gateInId,
        divergencias,
        ...(pessoaResponsavel ? { pessoaResponsavel } : {}),
      } as Record<string, unknown>,
    });

    if (this.hasCritical(divergencias)) {
      this.securityEvents.emit({
        type: 'CRITICAL_EVENT',
        tipo: 'GATE_DIVERGENCIA_CRITICA',
        userId: operadorId,
        solicitacaoId: gi.solicitacaoId,
        contexto: { gateInId, fase: 'checkout', divergencias } as Record<string, unknown>,
      });
    }

    return { ok: true, gateInId };
  }

  async listPatioUnidadesGateIn(gateInId: string) {
    return this.patioV2.listByGateIn(gateInId);
  }

  async enviarGateInParaPatio(
    gateInId: string,
    operadorId: string,
    posicoes: { unidadeId: string; codigoBaia: string }[],
  ) {
    const results = [];
    for (const p of posicoes) {
      results.push(
        await this.patioV2.posicionar(operadorId, {
          unidadeId: p.unidadeId,
          codigoBaia: p.codigoBaia,
          tipo: 'LIFT_ON',
        }),
      );
    }
    return { ok: true, posicionadas: results.length };
  }

  async listarFilaOperacional() {
    const rows = await this.prisma.solicitacao.findMany({
      where: {
        deletedAt: null,
        transporteSolicitacao: { isNot: null },
        status: {
          in: [
            StatusSolicitacao.AGUARDANDO_GATE_IN,
            StatusSolicitacao.APROVADO,
            StatusSolicitacao.EM_PATIO,
            StatusSolicitacao.AGUARDANDO_GATE_OUT,
          ],
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: {
        cliente: { select: { id: true, razaoSocial: true } },
        transporteSolicitacao: { select: { tipoCaminhao: true } },
        containersSolicitacao: { orderBy: { ordem: 'asc' }, select: { unidade: true, ordem: true } },
        unidades: { select: { numeroIso: true } },
        gateCheckIns: {
          where: { checkOut: null },
          select: { id: true, dataHora: true },
          take: 1,
        },
      },
    });

    return rows.map((r) => {
      let gateLabel = '—';
      if (r.status === StatusSolicitacao.AGUARDANDO_GATE_IN || r.status === StatusSolicitacao.APROVADO) {
        gateLabel = 'Aguardando check-in';
      } else if (r.status === StatusSolicitacao.EM_PATIO) {
        gateLabel = r.gateCheckIns[0] ? 'Em pátio (check-in registrado)' : 'Em pátio';
      } else if (r.status === StatusSolicitacao.AGUARDANDO_GATE_OUT) {
        gateLabel = 'Aguardando gate-out';
      }
      const tipo = r.transporteSolicitacao?.tipoCaminhao === TipoCaminhao.LS ? 'LS' : 'Rodotrem';
      const containersIso = [
        ...r.containersSolicitacao.map((c) => c.unidade),
        ...r.unidades.map((u) => u.numeroIso),
      ].filter(Boolean);
      return {
        id: r.id,
        protocolo: r.protocolo,
        containersIso,
        cliente: r.cliente,
        tipoCaminhao: tipo,
        statusDb: r.status,
        gateLabel,
        gateInAbertoId: r.gateCheckIns[0]?.id ?? null,
      };
    });
  }

  async metricasResumo() {
    const since = new Date(Date.now() - 30 * 86400000);
    const completed = await this.prisma.gateCheckOut.findMany({
      where: { dataHora: { gte: since } },
      include: {
        gateIn: {
          include: {
            solicitacao: {
              include: {
                cliente: true,
                transporteSolicitacao: true,
              },
            },
          },
        },
      },
      take: 2000,
    });

    let sumMinPatio = 0;
    let nPatio = 0;
    const divergenciasPorCliente = new Map<string, number>();
    let lacreDiv = 0;
    let containerDiv = 0;
    let totalDivScan = 0;
    let ls = 0;
    let rodo = 0;

    for (const co of completed) {
      const gi = co.gateIn;
      const dtMs = co.dataHora.getTime() - gi.dataHora.getTime();
      const min = dtMs / 60000;
      if (min >= 0 && min < 7 * 24 * 60) {
        sumMinPatio += min;
        nPatio++;
      }
      const tipo = gi.solicitacao.transporteSolicitacao?.tipoCaminhao;
      if (tipo === TipoCaminhao.LS) ls++;
      else if (tipo === TipoCaminhao.RODOTREM) rodo++;

      const mergeScan = [...this.asDivList(gi.divergenciasJson), ...this.asDivList(co.divergenciasJson)];
      for (const d of mergeScan) {
        totalDivScan++;
        const cid = gi.solicitacao.clienteId;
        divergenciasPorCliente.set(cid, (divergenciasPorCliente.get(cid) ?? 0) + 1);
        if (d.tipo === 'LACRE_DIVERGENTE') lacreDiv++;
        if (d.tipo === 'CONTAINER_TROCADO') containerDiv++;
      }
    }

    const checkInsRecent = await this.prisma.gateCheckIn.findMany({
      where: { dataHora: { gte: since } },
      select: { id: true, dataHora: true, solicitacaoId: true },
      take: 2000,
    });
    const checkIns = checkInsRecent.length;
    let sumEsperaGate = 0;
    let nEsperaGate = 0;
    if (checkInsRecent.length) {
      const solIds = [...new Set(checkInsRecent.map((g) => g.solicitacaoId))];
      const audits = await this.prisma.auditoria.findMany({
        where: {
          tabela: 'solicitacoes',
          registroId: { in: solIds },
          acao: AcaoAuditoria.UPDATE,
        },
        orderBy: { createdAt: 'asc' },
        select: { registroId: true, createdAt: true, dadosDepois: true },
      });
      const liberacaoPorSol = new Map<string, Date>();
      for (const a of audits) {
        const dep = a.dadosDepois as { deltas?: { campo: string; depois: string }[] } | null;
        const deltas = dep?.deltas;
        if (!Array.isArray(deltas)) continue;
        for (const d of deltas) {
          if (d.campo === 'status' && d.depois === StatusSolicitacao.AGUARDANDO_GATE_IN) {
            liberacaoPorSol.set(a.registroId, a.createdAt);
          }
        }
      }
      for (const gi of checkInsRecent) {
        const lib = liberacaoPorSol.get(gi.solicitacaoId);
        if (!lib) continue;
        const min = (gi.dataHora.getTime() - lib.getTime()) / 60000;
        if (min >= 0 && min < 30 * 24 * 60) {
          sumEsperaGate += min;
          nEsperaGate++;
        }
      }
    }
    const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);

    return {
      periodoDias: 30,
      desde: since.toISOString(),
      mediaMinutosEsperaGateIn: nEsperaGate
        ? Math.round((sumEsperaGate / nEsperaGate) * 10) / 10
        : null,
      mediaMinutosPatio: nPatio ? Math.round((sumMinPatio / nPatio) * 10) / 10 : null,
      totalCheckOuts: completed.length,
      totalCheckIns: checkIns,
      divergenciasPorCliente: [...divergenciasPorCliente.entries()].map(([clienteId, total]) => ({
        clienteId,
        total,
      })),
      percentualLacreDivergente: pct(lacreDiv, checkIns || 1),
      percentualContainerDivergente: pct(containerDiv, checkIns || 1),
      fluxoLsVsRodotrem: { LS: ls, RODOTREM: rodo },
      observacao:
        'Médias baseadas em pares check-in/out concluídos no período (amostra limitada a 2000 registros).',
    };
  }

  private asDivList(json: unknown): GateDivergenciaItemDto[] {
    if (!Array.isArray(json)) return [];
    return json.filter((x) => x && typeof x === 'object' && 'tipo' in x) as GateDivergenciaItemDto[];
  }

  async ocrPlacaMockFromBuffer(buffer: Buffer) {
    return pipelineOcrGateMock(buffer);
  }

  /**
   * Valida payload do QR Code da credencial do motorista (protocolo + container + versão).
   * Retorna apenas identificadores operacionais — sem dados financeiros.
   */
  async validarQrCredencial(protocoloRaw: string, containerRaw?: string, versaoRaw?: number) {
    const protocolo = protocoloRaw.trim();
    if (!protocolo) {
      return { valido: false, motivo: 'Protocolo obrigatório' };
    }

    const sol = await this.prisma.solicitacao.findFirst({
      where: {
        deletedAt: null,
        protocolo: { equals: protocolo, mode: 'insensitive' },
      },
      include: {
        containersSolicitacao: { orderBy: { ordem: 'asc' } },
        agendamentoSolicitacao: true,
        transporteSolicitacao: true,
        solicitanteContato: true,
        cliente: { select: { razaoSocial: true, nomeFantasia: true } },
        agendamentos: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!sol) {
      return { valido: false, motivo: 'Solicitação não encontrada' };
    }

    await this.holdRelease.assertSemBloqueioAtivo(sol.id);

    const versaoAtual = sol.versaoCredencial ?? 1;
    if (versaoRaw === undefined || versaoRaw !== versaoAtual) {
      throw new ForbiddenException(
        'QR Code desatualizado ou inválido. Uma alteração foi feita nesta solicitação. Exija a nova credencial gerada no portal.',
      );
    }

    const intent = sol.tipoOperacao;
    const frotaCliente =
      intent === TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA ||
      intent === TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA;

    if (!frotaCliente) {
      return { valido: false, motivo: 'Credencial QR não aplicável a esta operação' };
    }

    if (
      sol.status === StatusSolicitacao.CANCELADO ||
      sol.status === StatusSolicitacao.CANCELADO_CLIENTE ||
      sol.status === StatusSolicitacao.REJEITADO
    ) {
      return { valido: false, motivo: 'Solicitação não está ativa' };
    }

    const containersDb = [
      ...sol.containersSolicitacao.map((c) => stripContainerIsoCanonical(c.unidade)),
      ...(await this.prisma.unidade.findMany({
        where: { solicitacaoId: sol.id },
        select: { numeroIso: true },
      })).map((u) => stripContainerIsoCanonical(u.numeroIso)),
    ].filter(Boolean);

    const containersUnicos = [...new Set(containersDb)];

    if (!containersUnicos.length) {
      return { valido: false, motivo: 'Solicitação sem contêiner vinculado' };
    }

    const containerCanonQr = containerRaw?.trim()
      ? stripContainerIsoCanonical(containerRaw)
      : null;

    if (containerCanonQr && !containersUnicos.includes(containerCanonQr)) {
      return { valido: false, motivo: 'Contêiner não confere com a solicitação' };
    }

    const tr = sol.transporteSolicitacao;
    const placas = [tr?.placaCavalo, tr?.placaCarreta01, tr?.placaCarreta02]
      .map((p) => p?.trim().toUpperCase())
      .filter((p): p is string => Boolean(p));

    const cliente =
      sol.cliente?.nomeFantasia?.trim() ||
      sol.cliente?.razaoSocial?.trim() ||
      null;

    const ag = sol.agendamentoSolicitacao;
    const agTerminal = sol.agendamentos[0];

    return {
      valido: true,
      solicitacao: {
        id: sol.id,
        protocolo: sol.protocolo,
        status: sol.status,
        tipoOperacao: intent,
        cliente,
        motorista: tr?.nomeMotorista ?? null,
        placas,
        containers: containersUnicos,
        containerISO: containerCanonQr ?? containersUnicos[0],
        placaCavalo: tr?.placaCavalo ?? null,
        dataRef: ag?.dataRef?.toISOString().slice(0, 10) ?? null,
        data: ag?.dataRef?.toISOString().slice(0, 10) ?? null,
        turno: ag?.turno ?? null,
        versaoCredencial: sol.versaoCredencial,
        modalidadeTransporte:
          agTerminal?.modalidadeTransporte ?? ModalidadeTransporte.FROTA_CLIENTE,
        tipoOperacaoGate: agTerminal?.tipoOperacao ?? null,
      },
    };
  }

  private parseOsMeta(divergenciasJson: unknown): {
    osStatus: 'PENDENTE' | 'EM_EXECUCAO' | 'APROVADA' | 'REJEITADA';
    motivo?: string;
  } {
    const list = this.asDivList(divergenciasJson);
    const meta = list.find((d) => d.tipo === 'OUTRA' && d.antes === 'OS_META');
    if (meta?.depois) {
      try {
        const parsed = JSON.parse(meta.depois) as { osStatus?: string; motivo?: string };
        const st = parsed.osStatus;
        if (st === 'APROVADA' || st === 'REJEITADA' || st === 'EM_EXECUCAO') {
          return { osStatus: st, motivo: parsed.motivo };
        }
      } catch {
        /* ignore */
      }
    }
    return { osStatus: 'PENDENTE' };
  }

  private mergeOsMeta(
    divergenciasJson: unknown,
    patch: { osStatus: string; motivo?: string },
  ): GateDivergenciaItemDto[] {
    const list = this.asDivList(divergenciasJson).filter(
      (d) => !(d.tipo === 'OUTRA' && d.antes === 'OS_META'),
    );
    list.push({
      tipo: 'OUTRA',
      antes: 'OS_META',
      depois: JSON.stringify({ osStatus: patch.osStatus, motivo: patch.motivo }),
    });
    return list;
  }

  private deriveOsStatusFromPatio(
    patioUnits: { status: PatioStatus }[],
    meta: { osStatus: string },
  ): 'PENDENTE' | 'EM_EXECUCAO' | 'APROVADA' | 'REJEITADA' {
    if (meta.osStatus === 'APROVADA') return 'APROVADA';
    if (meta.osStatus === 'REJEITADA') return 'REJEITADA';
    const moving = patioUnits.some((u) => u.status === PatioStatus.MOVIMENTANDO);
    const stored = patioUnits.some((u) => u.status === PatioStatus.ESTOCADO);
    if (moving) return 'EM_EXECUCAO';
    if (stored && meta.osStatus === 'PENDENTE') return 'PENDENTE';
    return meta.osStatus as 'PENDENTE' | 'EM_EXECUCAO';
  }

  async listarCockpit(dataRefRaw?: string) {
    const dataRef = this.resolveDataRef(dataRefRaw);
    const [filaChegadaRows, operacaoRows, despachoRows, osRows, patioInv, patioUnidadesRows] = await Promise.all([
      this.prisma.solicitacao.findMany({
        where: {
          deletedAt: null,
          transporteSolicitacao: { isNot: null },
          portaria: { isNot: null },
          status: StatusSolicitacao.EM_EXECUCAO,
          gateCheckIns: { none: { checkOut: null } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        include: {
          cliente: { select: { id: true, razaoSocial: true } },
          portaria: true,
          transporteSolicitacao: { select: { tipoCaminhao: true } },
          containersSolicitacao: {
            orderBy: { ordem: 'asc' },
            select: { unidade: true, tipo: true, tamanho: true, status: true },
          },
          unidades: { select: { numeroIso: true, tipo: true } },
        },
      }),
      this.prisma.solicitacao.findMany({
        where: {
          deletedAt: null,
          status: StatusSolicitacao.EM_PATIO,
          gateCheckIns: { some: { checkOut: null } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        include: {
          cliente: { select: { id: true, razaoSocial: true } },
          portaria: { select: { placaVeiculo: true, motoristaNome: true } },
          transporteSolicitacao: { select: { tipoCaminhao: true } },
          containersSolicitacao: {
            orderBy: { ordem: 'asc' },
            select: { unidade: true, tipo: true, tamanho: true, status: true },
          },
          unidades: { select: { numeroIso: true, tipo: true } },
          gateCheckIns: {
            where: { checkOut: null },
            take: 1,
            include: {
              operador: { select: { id: true, email: true } },
              patioUnidades: { select: { id: true, status: true, unidadeIso: true } },
            },
          },
        },
      }),
      this.prisma.solicitacao.findMany({
        where: {
          deletedAt: null,
          status: StatusSolicitacao.AGUARDANDO_GATE_OUT,
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        include: {
          cliente: { select: { id: true, razaoSocial: true } },
          portaria: true,
          transporteSolicitacao: { select: { tipoCaminhao: true, placaCavalo: true } },
          containersSolicitacao: { orderBy: { ordem: 'asc' }, select: { unidade: true, tipo: true, tamanho: true, status: true } },
          unidades: { select: { numeroIso: true, tipo: true } },
          gateCheckIns: {
            where: { checkOut: null },
            take: 1,
            select: { id: true, dataHora: true, placaCavalo: true },
          },
        },
      }),
      this.prisma.gateCheckIn.findMany({
        where: {
          dataHora: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
        orderBy: { dataHora: 'desc' },
        take: 200,
        include: {
          operador: { select: { id: true, email: true } },
          solicitacao: {
            select: {
              id: true,
              protocolo: true,
              status: true,
              cliente: { select: { razaoSocial: true } },
              transporteSolicitacao: { select: { placaCavalo: true } },
              containersSolicitacao: { orderBy: { ordem: 'asc' }, select: { unidade: true } },
              unidades: { select: { numeroIso: true } },
            },
          },
          checkOut: { select: { dataHora: true } },
          patioUnidades: { select: { status: true } },
        },
      }),
      this.patioV2.inventario(),
      this.prisma.patioUnidade.findMany({
        where: {
          status: { notIn: [PatioStatus.AGUARDANDO_GATE_OUT] },
          solicitacao: { status: { in: [StatusSolicitacao.EM_PATIO, StatusSolicitacao.AGUARDANDO_GATE_OUT] } },
        },
        include: {
          posicaoAtual: { select: { codigoBaia: true } },
          solicitacao: { select: { protocolo: true, cliente: { select: { razaoSocial: true } } } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const mapContainers = (r: {
      containersSolicitacao: { unidade: string }[];
      unidades: { numeroIso: string }[];
    }) =>
      [
        ...r.containersSolicitacao.map((c) => c.unidade),
        ...r.unidades.map((u) => u.numeroIso),
      ].filter(Boolean);

    const filaChegada = filaChegadaRows.map((r) => {
      const cs = r.containersSolicitacao[0];
      const meta = this.containerDashboardMeta(cs, r.unidades[0]?.tipo ?? null);
      return {
      id: r.id,
      protocolo: r.protocolo,
      statusDb: r.status,
      placa: r.portaria?.placaVeiculo ?? null,
      motorista: r.portaria?.motoristaNome ?? null,
      containersIso: mapContainers(r),
      tipoCaminhao: r.transporteSolicitacao?.tipoCaminhao === TipoCaminhao.LS ? 'LS' : 'Rodotrem',
      tipoContainer: r.unidades[0]?.tipo ?? null,
      tipoTamanho: meta.tipoTamanho,
      situacao: meta.situacao,
      chegadaEm: r.portaria?.updatedAt?.toISOString() ?? r.updatedAt.toISOString(),
      fotosPortaria: {
        caminhao: (r.portaria?.fotosCaminhao as string[]) ?? [],
        container: (r.portaria?.fotosContainer as string[]) ?? [],
        documento: (r.portaria?.fotosLacre as string[]) ?? [],
      },
      cliente: r.cliente,
    };
    });

    const operacaoAtiva = operacaoRows.map((r) => {
      const gi = r.gateCheckIns[0];
      const meta = this.containerDashboardMeta(
        r.containersSolicitacao[0],
        r.unidades[0]?.tipo ?? null,
      );
      const metaOs = this.parseOsMeta(gi?.divergenciasJson);
      const osStatus = gi
        ? this.deriveOsStatusFromPatio(gi.patioUnidades, metaOs)
        : 'PENDENTE';
      const empilhadeira = gi?.patioUnidades.find((u) => u.status === PatioStatus.MOVIMENTANDO);
      return {
        id: r.id,
        protocolo: r.protocolo,
        statusDb: r.status,
        gateInId: gi?.id ?? null,
        placa: gi?.placaCavalo ?? r.portaria?.placaVeiculo ?? null,
        motorista: r.portaria?.motoristaNome ?? null,
        containersIso: mapContainers(r),
        tipoCaminhao: r.transporteSolicitacao?.tipoCaminhao === TipoCaminhao.LS ? 'LS' : 'Rodotrem',
        tipoTamanho: meta.tipoTamanho,
        situacao: meta.situacao,
        empilhadeiraAtribuida: empilhadeira ? `Mov. ${empilhadeira.unidadeIso}` : null,
        operador: gi?.operador?.email ?? null,
        osStatus,
        osMotivo: metaOs.motivo ?? null,
        entradaEm: gi?.dataHora?.toISOString() ?? null,
        liberadoEm: osStatus === 'APROVADA' ? r.updatedAt.toISOString() : null,
        slotBaia: null,
        cliente: r.cliente,
      };
    });

    const despacho = despachoRows.map((r) => {
      const gi = r.gateCheckIns[0];
      const cs = r.containersSolicitacao[0];
      const meta = this.containerDashboardMeta(cs, r.unidades[0]?.tipo ?? null);
      return {
        id: r.id,
        protocolo: r.protocolo,
        statusDb: r.status,
        gateInId: gi?.id ?? null,
        placa: gi?.placaCavalo ?? r.transporteSolicitacao?.placaCavalo ?? r.portaria?.placaVeiculo ?? null,
        motorista: r.portaria?.motoristaNome ?? null,
        containersIso: mapContainers(r),
        tipoTamanho: meta.tipoTamanho,
        situacao: meta.situacao,
        prontoDesde: gi?.dataHora?.toISOString() ?? r.updatedAt.toISOString(),
        cliente: r.cliente,
      };
    });

    const ordensServico = osRows.map((gi) => {
      const meta = this.parseOsMeta(gi.divergenciasJson);
      const osStatus = this.deriveOsStatusFromPatio(gi.patioUnidades, meta);
      const fim = gi.checkOut?.dataHora;
      const durMin = fim
        ? Math.round((fim.getTime() - gi.dataHora.getTime()) / 60000)
        : Math.round((Date.now() - gi.dataHora.getTime()) / 60000);
      const containersIso = [
        ...gi.solicitacao.containersSolicitacao.map((c) => c.unidade),
        ...gi.solicitacao.unidades.map((u) => u.numeroIso),
      ].filter(Boolean);
      return {
        id: gi.id,
        solicitacaoId: gi.solicitacao.id,
        protocolo: gi.solicitacao.protocolo,
        placa: gi.solicitacao.transporteSolicitacao?.placaCavalo ?? null,
        containersIso,
        operador: gi.operador?.email ?? null,
        osStatus,
        duracaoMin: durMin,
        iniciadaEm: gi.dataHora.toISOString(),
        turno: this.turnoFromDate(gi.dataHora),
      };
    });

    const patioRows = patioUnidadesRows.map((u) => {
      const diasNoPatio = Math.floor((Date.now() - u.createdAt.getTime()) / 86_400_000);
      return {
        stack: u.posicaoAtual?.codigoBaia ?? '—',
        posicao: u.posicaoAtual?.codigoBaia ?? '—',
        unidadeId: u.id,
        container: u.unidadeIso,
        tipo: u.refrigerado ? 'Reefer' : 'Dry',
        status: u.status,
        refrigerado: u.refrigerado,
        protocolo: u.solicitacao.protocolo,
        cliente: u.solicitacao.cliente?.razaoSocial ?? '—',
        diasNoPatio,
        entradaEm: u.createdAt.toISOString(),
      };
    });

    return {
      geradoEm: new Date().toISOString(),
      dataRef: dataRef.toISOString().slice(0, 10),
      patio: {
        ocupados: patioInv.lotacaoTotal,
        capacidade: patioInv.capacidadeTotal,
        reefersLigados: patioInv.reefersLigados,
        unidades: patioRows,
        alertasDias: patioRows.filter((u) => u.diasNoPatio > 3).length,
      },
      filaChegada,
      operacaoAtiva,
      despacho,
      ordensServico,
      notificacoes: this.buildCockpitNotificacoes(filaChegada, patioRows),
      dashboard: await this.buildCockpitDashboard(dataRef, filaChegada, operacaoAtiva, despacho),
    };
  }

  private resolveDataRef(raw?: string): Date {
    if (raw?.trim()) {
      const d = new Date(`${raw.trim()}T12:00:00`);
      if (!Number.isNaN(d.getTime())) return d;
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private turnoAgendamentoToGate(t: TurnoAgendamento): 'T1' | 'T2' | 'T3' {
    if (t === TurnoAgendamento.MANHA) return 'T1';
    if (t === TurnoAgendamento.TARDE) return 'T2';
    return 'T3';
  }

  private horarioTurnoLabel(t: 'T1' | 'T2' | 'T3'): string {
    if (t === 'T1') return '07:00';
    if (t === 'T2') return '15:00';
    return '23:00';
  }

  private mapContainersFromRow(r: {
    containersSolicitacao: { unidade: string }[];
    unidades: { numeroIso: string }[];
  }) {
    return [
      ...r.containersSolicitacao.map((c) => c.unidade),
      ...r.unidades.map((u) => u.numeroIso),
    ].filter(Boolean);
  }

  private containerDashboardMeta(
    cs?: { tipo: string; tamanho: string; status: StatusContainer } | null,
    fallbackTipo?: string | null,
  ): { tipoTamanho: string | null; situacao: 'CHEIO' | 'VAZIO' | null } {
    if (!cs) {
      return {
        tipoTamanho: fallbackTipo ?? null,
        situacao: null,
      };
    }
    const situacao: 'CHEIO' | 'VAZIO' =
      cs.status === StatusContainer.CHEIO ? 'CHEIO' : 'VAZIO';
    return {
      tipoTamanho: `${cs.tipo} / ${cs.tamanho}`,
      situacao,
    };
  }

  private async buildCockpitDashboard(
    dataRef: Date,
    filaChegada: {
      id: string;
      protocolo: string;
      placa: string | null;
      containersIso: string[];
      cliente: { razaoSocial: string };
      chegadaEm: string;
      tipoTamanho: string | null;
      situacao: 'CHEIO' | 'VAZIO' | null;
    }[],
    operacaoAtiva: {
      id: string;
      protocolo: string;
      containersIso: string[];
      empilhadeiraAtribuida: string | null;
      osStatus: string;
      tipoTamanho: string | null;
      situacao: 'CHEIO' | 'VAZIO' | null;
    }[],
    despacho: {
      id: string;
      protocolo: string;
      placa: string | null;
      containersIso: string[];
      statusDb: string;
      prontoDesde: string;
    }[],
  ) {
    const dayStart = new Date(dataRef);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const autorizacaoRows = await this.prisma.solicitacao.findMany({
      where: {
        deletedAt: null,
        transporteSolicitacao: { isNot: null },
        status: { in: [StatusSolicitacao.PENDENTE, StatusSolicitacao.EM_ANALISE] },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        cliente: { select: { razaoSocial: true } },
        containersSolicitacao: { orderBy: { ordem: 'asc' }, select: { unidade: true, tamanho: true, tipo: true, status: true } },
        unidades: { select: { numeroIso: true, tipo: true } },
        agendamentoSolicitacao: { select: { turno: true } },
      },
    });

    const chegadaRows = await this.prisma.solicitacao.findMany({
      where: {
        deletedAt: null,
        transporteSolicitacao: { isNot: null },
        agendamentoSolicitacao: { dataRef: { gte: dayStart, lt: dayEnd } },
        status: {
          in: [
            StatusSolicitacao.APROVADO,
            StatusSolicitacao.AGUARDANDO_GATE_IN,
            StatusSolicitacao.EM_EXECUCAO,
          ],
        },
      },
      include: {
        cliente: { select: { razaoSocial: true } },
        transporteSolicitacao: { select: { placaCavalo: true, tipoCaminhao: true } },
        containersSolicitacao: { orderBy: { ordem: 'asc' }, select: { unidade: true, tamanho: true, tipo: true, status: true } },
        unidades: { select: { numeroIso: true } },
        agendamentoSolicitacao: { select: { turno: true, dataRef: true } },
        portaria: { select: { id: true } },
      },
    });

    const saidaRows = await this.prisma.solicitacao.findMany({
      where: {
        deletedAt: null,
        OR: [
          { status: StatusSolicitacao.AGUARDANDO_GATE_OUT },
          {
            status: { in: [StatusSolicitacao.EM_PATIO, StatusSolicitacao.EM_EXECUCAO] },
            agendamentoSolicitacao: { dataRef: { gte: dayStart, lt: dayEnd } },
          },
        ],
      },
      include: {
        cliente: { select: { razaoSocial: true } },
        transporteSolicitacao: { select: { placaCavalo: true } },
        containersSolicitacao: {
          orderBy: { ordem: 'asc' },
          select: { unidade: true, tamanho: true, tipo: true, status: true },
        },
        unidades: { select: { numeroIso: true } },
        agendamentoSolicitacao: { select: { turno: true } },
      },
    });

    const now = new Date();
    const turnoAtual = this.turnoFromDate(now);

    const autorizacoesPendentes = autorizacaoRows.map((r) => {
      const containersIso = this.mapContainersFromRow(r);
      const cs = r.containersSolicitacao[0];
      const meta = this.containerDashboardMeta(cs, r.unidades[0]?.tipo ?? null);
      return {
        id: r.id,
        protocolo: r.protocolo,
        empresa: r.cliente.razaoSocial,
        containersIso,
        tipoTamanho: meta.tipoTamanho,
        situacao: meta.situacao,
        solicitadoEm: r.createdAt.toISOString(),
        turno: r.agendamentoSolicitacao
          ? this.turnoAgendamentoToGate(r.agendamentoSolicitacao.turno)
          : null,
      };
    });

    const previsaoChegadas = chegadaRows
      .map((r) => {
        const cs = r.containersSolicitacao[0];
        const meta = this.containerDashboardMeta(cs);
        const turno = r.agendamentoSolicitacao
          ? this.turnoAgendamentoToGate(r.agendamentoSolicitacao.turno)
          : this.turnoFromDate(r.createdAt);
        const horario = this.horarioTurnoLabel(turno);
        const chegouPortaria = Boolean(r.portaria) || r.status === StatusSolicitacao.EM_EXECUCAO;
        const turnoFim =
          turno === 'T1' ? 14 : turno === 'T2' ? 22 : 6;
        const atrasado =
          !chegouPortaria &&
          ((turno === 'T3' && now.getHours() >= 22) ||
            (turno !== 'T3' && now.getHours() >= turnoFim));
        return {
          id: r.id,
          horario,
          placa: r.transporteSolicitacao?.placaCavalo ?? null,
          containersIso: this.mapContainersFromRow(r),
          empresa: r.cliente.razaoSocial,
          tipoTamanho: meta.tipoTamanho,
          situacao: meta.situacao,
          turno,
          statusDb: r.status,
          chegouPortaria,
          atrasado,
        };
      })
      .sort((a, b) => a.horario.localeCompare(b.horario));

    const previsaoSaidas = saidaRows
      .map((r) => {
        const cs = r.containersSolicitacao[0];
        const meta = this.containerDashboardMeta(cs);
        const turno = r.agendamentoSolicitacao
          ? this.turnoAgendamentoToGate(r.agendamentoSolicitacao.turno)
          : 'T2';
        const pronto = r.status === StatusSolicitacao.AGUARDANDO_GATE_OUT;
        let statusLabel = 'Em Operação';
        if (pronto) statusLabel = 'Pronto Despacho';
        else if (r.status === StatusSolicitacao.EM_PATIO) statusLabel = 'No Pátio';
        return {
          id: r.id,
          horarioPrevisto: this.horarioTurnoLabel(turno),
          placa: r.transporteSolicitacao?.placaCavalo ?? null,
          containersIso: this.mapContainersFromRow(r),
          tipoTamanho: meta.tipoTamanho,
          situacao: meta.situacao,
          statusLabel,
          statusDb: r.status,
          pronto,
        };
      })
      .sort((a, b) => a.horarioPrevisto.localeCompare(b.horarioPrevisto));

    const agendaBase = (['T1', 'T2', 'T3'] as const).map((t) => ({
      turno: t,
      chegadasPrevistas: 0,
      chegadasRealizadas: 0,
      saidasPrevistas: 0,
      saidasRealizadas: 0,
    }));

    for (const r of chegadaRows) {
      const t = r.agendamentoSolicitacao
        ? this.turnoAgendamentoToGate(r.agendamentoSolicitacao.turno)
        : 'T1';
      const slot = agendaBase.find((a) => a.turno === t)!;
      slot.chegadasPrevistas++;
      if (r.portaria || r.status === StatusSolicitacao.EM_EXECUCAO) slot.chegadasRealizadas++;
    }
    for (const r of saidaRows) {
      const t = r.agendamentoSolicitacao
        ? this.turnoAgendamentoToGate(r.agendamentoSolicitacao.turno)
        : 'T2';
      const slot = agendaBase.find((a) => a.turno === t)!;
      slot.saidasPrevistas++;
      if (r.status === StatusSolicitacao.AGUARDANDO_GATE_OUT) slot.saidasRealizadas++;
    }

    return {
      autorizacoesPendentes: {
        total: autorizacoesPendentes.length,
        itens: autorizacoesPendentes.slice(0, 5),
      },
      previsaoChegadas: {
        total: previsaoChegadas.length,
        itens: previsaoChegadas.slice(0, 12),
      },
      previsaoSaidas: {
        total: previsaoSaidas.length,
        itens: previsaoSaidas.slice(0, 12),
      },
      agendaTurnos: {
        turnoAtual,
        turnos: agendaBase.map((t) => ({
          ...t,
          progressoPct:
            t.chegadasPrevistas > 0
              ? Math.round((t.chegadasRealizadas / t.chegadasPrevistas) * 100)
              : 0,
        })),
      },
      resumoFila: {
        total: filaChegada.length,
        itens: filaChegada.slice(0, 3).map((f) => ({
          id: f.id,
          protocolo: f.protocolo,
          placa: f.placa,
          containersIso: f.containersIso,
          empresa: f.cliente.razaoSocial,
          chegadaEm: f.chegadaEm,
          tipoTamanho: f.tipoTamanho,
          situacao: f.situacao,
        })),
      },
      resumoOperacao: {
        total: operacaoAtiva.length,
        itens: operacaoAtiva.slice(0, 3).map((o) => ({
          id: o.id,
          protocolo: o.protocolo,
          containersIso: o.containersIso,
          empilhadeira: o.empilhadeiraAtribuida,
          osStatus: o.osStatus,
          tipoTamanho: o.tipoTamanho,
          situacao: o.situacao,
        })),
      },
    };
  }

  private buildCockpitNotificacoes(
    fila: { protocolo: string; placa: string | null }[],
    patio: { container: string; diasNoPatio: number }[],
  ) {
    const notes: { id: string; tipo: string; mensagem: string; em: string }[] = [];
    for (const f of fila.slice(0, 5)) {
      notes.push({
        id: `chegada-${f.protocolo}`,
        tipo: 'CHEGADA_PORTARIA',
        mensagem: `Caminhão ${f.placa ?? '—'} liberado na portaria (${f.protocolo})`,
        em: new Date().toISOString(),
      });
    }
    for (const p of patio.filter((u) => u.diasNoPatio > 3).slice(0, 5)) {
      notes.push({
        id: `patio-${p.container}`,
        tipo: 'PATIO_LIMITE',
        mensagem: `Contêiner ${p.container} com ${p.diasNoPatio} dias no pátio`,
        em: new Date().toISOString(),
      });
    }
    return notes;
  }

  private turnoFromDate(d: Date): 'T1' | 'T2' | 'T3' {
    const h = d.getHours();
    if (h >= 6 && h < 14) return 'T1';
    if (h >= 14 && h < 22) return 'T2';
    return 'T3';
  }

  async direcionarOperacao(solicitacaoId: string, operadorId: string) {
    const sol = await this.prisma.solicitacao.findFirst({
      where: { id: solicitacaoId, deletedAt: null },
      include: { portaria: true },
    });
    if (!sol) throw new NotFoundException('Solicitação não encontrada');
    if (!sol.portaria) {
      throw new BadRequestException('Caminhão sem registro de portaria');
    }
    if (sol.status !== StatusSolicitacao.EM_EXECUCAO) {
      throw new BadRequestException(`Status não permite direcionamento (${sol.status})`);
    }
    await this.prisma.solicitacao.update({
      where: { id: solicitacaoId },
      data: { status: StatusSolicitacao.AGUARDANDO_GATE_IN },
    });
    await this.auditoria.registrar({
      tabela: 'solicitacoes',
      registroId: solicitacaoId,
      acao: AcaoAuditoria.UPDATE,
      usuario: operadorId,
      solicitacaoId,
      dadosAntes: { status: StatusSolicitacao.EM_EXECUCAO },
      dadosDepois: { status: StatusSolicitacao.AGUARDANDO_GATE_IN, motivo: 'gate_direcionar_operacao' },
    });
    return { ok: true, status: StatusSolicitacao.AGUARDANDO_GATE_IN };
  }

  async retornarEntrada(solicitacaoId: string, operadorId: string, motivo: string) {
    const sol = await this.prisma.solicitacao.findFirst({
      where: { id: solicitacaoId, deletedAt: null },
    });
    if (!sol) throw new NotFoundException('Solicitação não encontrada');
    if (sol.status !== StatusSolicitacao.EM_EXECUCAO) {
      throw new BadRequestException(`Status não permite retorno (${sol.status})`);
    }
    await this.prisma.solicitacao.update({
      where: { id: solicitacaoId },
      data: { status: StatusSolicitacao.APROVADO },
    });
    await this.auditoria.registrar({
      tabela: 'solicitacoes',
      registroId: solicitacaoId,
      acao: AcaoAuditoria.UPDATE,
      usuario: operadorId,
      solicitacaoId,
      dadosAntes: { status: StatusSolicitacao.EM_EXECUCAO },
      dadosDepois: { status: StatusSolicitacao.APROVADO, motivo: 'gate_retorno_entrada', detalhe: motivo },
    });
    return { ok: true, status: StatusSolicitacao.APROVADO };
  }

  private assertPodeAprovarOs(role: Role) {
    if (role !== Role.ADMIN && role !== Role.GERENTE) {
      throw new ForbiddenException('Aprovação/rejeição de OS exige perfil ADMIN ou GERENTE');
    }
  }

  async aprovarOs(gateInId: string, operadorId: string, role: Role) {
    this.assertPodeAprovarOs(role);
    const gi = await this.prisma.gateCheckIn.findUnique({ where: { id: gateInId } });
    if (!gi) throw new NotFoundException('Check-in não encontrado');
    const divergencias = this.mergeOsMeta(gi.divergenciasJson, { osStatus: 'APROVADA' });
    await this.prisma.gateCheckIn.update({
      where: { id: gateInId },
      data: { divergenciasJson: divergencias as unknown as Prisma.InputJsonValue },
    });
    await this.auditoria.registrar({
      tabela: 'gate_v2_check_ins',
      registroId: gateInId,
      acao: AcaoAuditoria.UPDATE,
      usuario: operadorId,
      solicitacaoId: gi.solicitacaoId,
      dadosDepois: { osStatus: 'APROVADA' },
    });
    return { ok: true, osStatus: 'APROVADA' };
  }

  async rejeitarOs(gateInId: string, operadorId: string, role: Role, motivo: string) {
    this.assertPodeAprovarOs(role);
    const gi = await this.prisma.gateCheckIn.findUnique({ where: { id: gateInId } });
    if (!gi) throw new NotFoundException('Check-in não encontrado');
    const divergencias = this.mergeOsMeta(gi.divergenciasJson, { osStatus: 'REJEITADA', motivo });
    await this.prisma.gateCheckIn.update({
      where: { id: gateInId },
      data: { divergenciasJson: divergencias as unknown as Prisma.InputJsonValue },
    });
    await this.auditoria.registrar({
      tabela: 'gate_v2_check_ins',
      registroId: gateInId,
      acao: AcaoAuditoria.UPDATE,
      usuario: operadorId,
      solicitacaoId: gi.solicitacaoId,
      dadosDepois: { osStatus: 'REJEITADA', motivo },
    });
    return { ok: true, osStatus: 'REJEITADA' };
  }
}
