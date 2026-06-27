import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AcaoAuditoria, ModalidadeTransporte, Prisma, StatusSolicitacao, TipoCaminhao, TipoOperacaoSolicitacaoIntent } from '@prisma/client';
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
}
