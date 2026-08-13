import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MomentoAvaria } from '@prisma/client';
import { stripContainerIsoCanonical } from '../common/utils/data-sanitize';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ContainerRicPayload,
  ContainerRicTipo,
  ContainerTimelineEvent,
  ContainerTimelineResponse,
} from './container-timeline.types';

function formatIsoDisplay(iso: string): string {
  if (iso.length !== 11) return iso;
  return `${iso.slice(0, 4)} ${iso.slice(4, 10)}-${iso.slice(10)}`;
}

function asStringArray(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return json.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

@Injectable()
export class ContainerTimelineService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminTimeline(isoRaw: string): Promise<ContainerTimelineResponse> {
    const iso = stripContainerIsoCanonical(isoRaw);
    const ctx = await this.loadContext(iso);
    if (!ctx.hasData) {
      throw new NotFoundException(`Nenhum registro operacional encontrado para ${formatIsoDisplay(iso)}.`);
    }
    return this.buildResponse(iso, ctx, 'admin');
  }

  async getClientTimeline(isoRaw: string, clienteId: string): Promise<ContainerTimelineResponse> {
    const iso = stripContainerIsoCanonical(isoRaw);
    await this.assertClienteOwnsIso(iso, clienteId);
    const ctx = await this.loadContext(iso);
    if (!ctx.hasData) {
      throw new NotFoundException(`Contêiner não encontrado para sua conta.`);
    }
    return this.buildResponse(iso, ctx, 'client');
  }

  async getRicPayload(isoRaw: string, tipo: ContainerRicTipo): Promise<ContainerRicPayload> {
    const iso = stripContainerIsoCanonical(isoRaw);
    const ctx = await this.loadContext(iso);
    if (!ctx.hasData) {
      throw new NotFoundException(`Contêiner ${formatIsoDisplay(iso)} não encontrado.`);
    }

    const patioRow =
      ctx.patioUnidades.find((p) => p.unidadeIso === iso) ?? ctx.patioUnidades[0] ?? null;
    const gateIn =
      (patioRow as (typeof ctx.patioUnidades)[number] | null)?.gateIn ??
      ctx.gateCheckIns.find((g) => ctx.matchingSolicitacaoIds.includes(g.solicitacaoId));

    if (!gateIn) {
      throw new NotFoundException('Gate-In não registrado para este contêiner.');
    }

    const solicitacao =
      (patioRow as (typeof ctx.patioUnidades)[number] | null)?.solicitacao ??
      ctx.containerSolicitacoes.find((c) => c.solicitacaoId === gateIn.solicitacaoId)?.solicitacao ??
      null;

    const transporte =
      ctx.containerSolicitacoes.find((c) => c.solicitacaoId === gateIn.solicitacaoId)?.solicitacao
        .transporteSolicitacao ?? null;
    const protocolo = solicitacao?.protocolo ?? '—';
    const operador =
      tipo === 'SAIDA' && gateIn.checkOut?.operador
        ? gateIn.checkOut.operador
        : gateIn.operador;

    const divergencias =
      tipo === 'SAIDA'
        ? (gateIn.checkOut?.divergenciasJson ?? [])
        : gateIn.divergenciasJson;
    const fotos =
      tipo === 'SAIDA'
        ? asStringArray(gateIn.checkOut?.fotosSaida)
        : asStringArray(gateIn.fotosEntrada);
    const dataHora =
      tipo === 'SAIDA' && gateIn.checkOut
        ? gateIn.checkOut.dataHora.toISOString()
        : gateIn.dataHora.toISOString();

    if (tipo === 'SAIDA' && !gateIn.checkOut) {
      throw new NotFoundException('Gate-Out ainda não registrado para este contêiner.');
    }

    const legacyGate = ctx.legacyGates.find((g) => g.solicitacaoId === gateIn.solicitacaoId);

    return {
      tipo,
      iso,
      isoFormatado: formatIsoDisplay(iso),
      protocolo,
      solicitacaoId: gateIn.solicitacaoId,
      emitidoEm: new Date().toISOString(),
      terminal: {
        nome: 'RL Transportes — Terminal Navegantes',
        cnpj: process.env.RL_TERMINAL_CNPJ ?? undefined,
      },
      transporte: {
        motoristaNome: transporte?.nomeMotorista ?? gateIn.motoristaNome,
        motoristaCpf: transporte?.cpfMotorista ?? gateIn.motoristaCpf,
        placaCavalo: transporte?.placaCavalo ?? gateIn.placaCavalo,
        placaCarreta01: transporte?.placaCarreta01 ?? gateIn.placaCarreta01,
        placaCarreta02: transporte?.placaCarreta02 ?? gateIn.placaCarreta02,
      },
      operador: {
        id: operador.id,
        nome: operador.email?.split('@')[0] ?? 'Operador',
        email: operador.email ?? undefined,
      },
      dataHora,
      fotos,
      divergencias: Array.isArray(divergencias) ? divergencias : [],
      observacoesInternas: ctx.internalNotes,
      assinaturaRicPresente: legacyGate?.ricAssinado ?? false,
      hashPdfValidado: gateIn.pdfHashValidado,
    };
  }

  private async assertClienteOwnsIso(iso: string, clienteId: string): Promise<void> {
    const owned = await this.clienteOwnsIso(iso, clienteId);
    if (!owned) {
      throw new ForbiddenException('Contêiner não pertence ao cliente autenticado.');
    }
  }

  private async clienteOwnsIso(iso: string, clienteId: string): Promise<boolean> {
    const ctx = await this.loadContext(iso);
    if (ctx.agendamentos.some((a) => a.clienteId === clienteId)) return true;
    if (ctx.tosContainer?.clienteId === clienteId) return true;
    if (ctx.containerSolicitacoes.some((c) => c.solicitacao.clienteId === clienteId)) return true;
    if (ctx.unidades.some((u) => u.solicitacao?.clienteId === clienteId)) return true;
    if (ctx.patioUnidades.some((p) => p.solicitacao?.clienteId === clienteId)) return true;
    return false;
  }

  private async loadContext(iso: string) {
    const prefix = iso.slice(0, 4);

    const [
      containerSolicitacoesRaw,
      unidadesRaw,
      agendamentos,
      patioUnidades,
      tosContainer,
      agendamentosSolicitacao,
    ] = await Promise.all([
      this.prisma.containerSolicitacao.findMany({
        where: { unidade: { startsWith: prefix, mode: 'insensitive' } },
        include: {
          solicitacao: {
            include: {
              cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
              transporteSolicitacao: true,
              agendamentoSolicitacao: true,
            },
          },
        },
      }),
      this.prisma.unidade.findMany({
        where: { numeroIso: { startsWith: prefix, mode: 'insensitive' } },
        include: {
          solicitacao: {
            select: {
              id: true,
              protocolo: true,
              clienteId: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.agendamentoTerminal.findMany({
        where: { numeroIso: iso },
        include: {
          cliente: { select: { id: true, razaoSocial: true } },
          solicitacao: { select: { id: true, protocolo: true, status: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.patioUnidade.findMany({
        where: { unidadeIso: iso },
        include: {
          solicitacao: {
            select: {
              id: true,
              protocolo: true,
              clienteId: true,
              status: true,
            },
          },
          posicaoAtual: { select: { codigoBaia: true } },
          movimentacoes: {
            orderBy: { createdAt: 'asc' },
            include: {
              operador: { select: { id: true, email: true } },
              origem: { select: { codigoBaia: true } },
              destino: { select: { codigoBaia: true } },
            },
          },
          gateIn: {
            include: {
              operador: { select: { id: true, email: true } },
              checkOut: {
                include: { operador: { select: { id: true, email: true } } },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.container.findUnique({
        where: { numero: iso },
        include: {
          avarias: { orderBy: { createdAt: 'asc' } },
          eventos: { orderBy: { createdAt: 'asc' } },
          cliente: { select: { id: true, razaoSocial: true } },
          agendamento: true,
        },
      }),
      this.prisma.agendamentoSolicitacao.findMany({
        where: {
          solicitacao: {
            OR: [
              { containersSolicitacao: { some: { unidade: { startsWith: prefix, mode: 'insensitive' } } } },
              { unidades: { some: { numeroIso: { startsWith: prefix, mode: 'insensitive' } } } },
            ],
          },
        },
        include: {
          solicitacao: {
            select: { id: true, protocolo: true, status: true, clienteId: true },
          },
        },
      }),
    ]);

    const containerSolicitacoes = containerSolicitacoesRaw.filter(
      (c) => stripContainerIsoCanonical(c.unidade) === iso,
    );
    const unidades = unidadesRaw.filter((u) => stripContainerIsoCanonical(u.numeroIso) === iso);

    const matchingSolicitacaoIds = [
      ...new Set([
        ...containerSolicitacoes.map((c) => c.solicitacaoId),
        ...unidades.map((u) => u.solicitacaoId),
        ...agendamentos.filter((a) => a.solicitacaoId).map((a) => a.solicitacaoId as string),
        ...patioUnidades.map((p) => p.solicitacaoId),
        ...agendamentosSolicitacao
          .filter((a) =>
            containerSolicitacoes.some((c) => c.solicitacaoId === a.solicitacaoId) ||
            unidades.some((u) => u.solicitacaoId === a.solicitacaoId),
          )
          .map((a) => a.solicitacaoId),
      ]),
    ];

    const [gateCheckIns, legacyGates] = matchingSolicitacaoIds.length
      ? await Promise.all([
          this.prisma.gateCheckIn.findMany({
            where: { solicitacaoId: { in: matchingSolicitacaoIds } },
            include: {
              operador: { select: { id: true, email: true } },
              checkOut: {
                include: { operador: { select: { id: true, email: true } } },
              },
            },
            orderBy: { dataHora: 'asc' },
          }),
          this.prisma.gate.findMany({ where: { solicitacaoId: { in: matchingSolicitacaoIds } } }),
        ])
      : [[], []];

    const internalNotes: string[] = [];
    for (const u of unidades) {
      if (u.movimentacaoBloqueada && u.bloqueioMotivo) {
        internalNotes.push(`Bloqueio (${u.bloqueioTipo ?? 'OPERACIONAL'}): ${u.bloqueioMotivo}`);
      }
    }

    const hasData =
      containerSolicitacoes.length > 0 ||
      unidades.length > 0 ||
      agendamentos.length > 0 ||
      patioUnidades.length > 0 ||
      !!tosContainer ||
      gateCheckIns.length > 0;

    return {
      hasData,
      containerSolicitacoes,
      unidades,
      agendamentos,
      patioUnidades,
      tosContainer,
      agendamentosSolicitacao,
      gateCheckIns,
      legacyGates,
      matchingSolicitacaoIds,
      internalNotes,
    };
  }

  private buildResponse(
    iso: string,
    ctx: Awaited<ReturnType<ContainerTimelineService['loadContext']>>,
    mode: 'admin' | 'client',
  ): ContainerTimelineResponse {
    const eventos: ContainerTimelineEvent[] = [];

    for (const ag of ctx.agendamentos) {
      eventos.push({
        id: `ag-${ag.id}`,
        tipo: 'AGENDAMENTO',
        ocorridoEm: ag.createdAt.toISOString(),
        titulo: 'Agendamento terminal',
        resumo: `${ag.tipoOperacao} · ${ag.turno} · ${ag.status}`,
        visibilidade: 'PUBLIC',
        protocolo: ag.solicitacao?.protocolo ?? undefined,
        metadata: {
          dataRef: ag.dataRef.toISOString().slice(0, 10),
          turno: ag.turno,
          status: ag.status,
          modalidade: ag.modalidadeTransporte,
          statusCarga: ag.statusCarga,
          cliente: ag.cliente.razaoSocial,
          motivoReprovacao: mode === 'admin' ? ag.motivoReprovacao : undefined,
        },
      });
    }

    for (const ags of ctx.agendamentosSolicitacao) {
      if (ctx.agendamentos.some((a) => a.solicitacaoId === ags.solicitacaoId)) continue;
      eventos.push({
        id: `ags-${ags.id}`,
        tipo: 'AGENDAMENTO',
        ocorridoEm: ags.createdAt.toISOString(),
        titulo: 'Agendamento corporativo',
        resumo: `${String(ags.dataRef).slice(0, 10)} · ${ags.turno}`,
        visibilidade: 'PUBLIC',
        protocolo: ags.solicitacao.protocolo,
        metadata: {
          dataRef: String(ags.dataRef).slice(0, 10),
          turno: ags.turno,
          statusSolicitacao: ags.solicitacao.status,
          atendimentoEspecial: ags.atendimentoEspecial,
          ...(mode === 'admin' ? { atendimentoEspecialTexto: ags.atendimentoEspecialTexto } : {}),
        },
      });
    }

    if (ctx.tosContainer) {
      for (const av of ctx.tosContainer.avarias) {
        const publicPhotos = av.momento === MomentoAvaria.GATE_OUT ? av.fotos : av.fotos;
        eventos.push({
          id: `av-${av.id}`,
          tipo: 'VISTORIA_EIR',
          ocorridoEm: av.createdAt.toISOString(),
          titulo: av.momento === MomentoAvaria.GATE_IN ? 'Vistoria / EIR (entrada)' : 'Vistoria / EIR (saída)',
          resumo: av.descricao,
          visibilidade: 'PUBLIC',
          fotos: publicPhotos,
          metadata: {
            momento: av.momento,
            ...(mode === 'admin' ? { descricaoCompleta: av.descricao } : {}),
          },
        });
      }
    }

    const gateInsSeen = new Set<string>();
    const allGateIns = [
      ...ctx.gateCheckIns,
      ...ctx.patioUnidades.map((p) => p.gateIn).filter(Boolean),
    ] as typeof ctx.gateCheckIns;

    for (const gi of allGateIns) {
      if (gateInsSeen.has(gi.id)) continue;
      gateInsSeen.add(gi.id);

      const protocolo =
        ctx.containerSolicitacoes.find((c) => c.solicitacaoId === gi.solicitacaoId)?.solicitacao
          .protocolo ??
        ctx.patioUnidades.find((p) => p.gateInId === gi.id)?.solicitacao.protocolo;

      const divergencias = Array.isArray(gi.divergenciasJson) ? gi.divergenciasJson : [];
      if (divergencias.length) {
        eventos.push({
          id: `eir-in-${gi.id}`,
          tipo: 'VISTORIA_EIR',
          ocorridoEm: gi.dataHora.toISOString(),
          titulo: 'EIR — divergências na entrada',
          resumo: `${divergencias.length} registro(s) de divergência`,
          visibilidade: 'PUBLIC',
          fotos: asStringArray(gi.fotosEntrada),
          protocolo,
          metadata: {
            divergencias: mode === 'admin' ? divergencias : divergencias.map((d) => ({ ...(d as object) })),
          },
        });
      }

      eventos.push({
        id: `gin-${gi.id}`,
        tipo: 'GATE_IN',
        ocorridoEm: gi.dataHora.toISOString(),
        titulo: 'Gate-In',
        resumo: `${gi.placaCavalo} · ${gi.motoristaNome}`,
        visibilidade: 'PUBLIC',
        protocolo,
        fotos: asStringArray(gi.fotosEntrada),
        metadata: {
          placaCavalo: gi.placaCavalo,
          placaCarreta01: gi.placaCarreta01,
          placaCarreta02: gi.placaCarreta02,
          motoristaNome: gi.motoristaNome,
          motoristaCpf: mode === 'admin' ? gi.motoristaCpf : undefined,
          operador: gi.operador.email,
          pdfHashValidado: mode === 'admin' ? gi.pdfHashValidado : undefined,
        },
        ric: {
          disponivel: true,
          tipo: 'ENTRADA',
          gateCheckInId: gi.id,
        },
      });

      if (gi.checkOut) {
        const divOut = Array.isArray(gi.checkOut.divergenciasJson) ? gi.checkOut.divergenciasJson : [];
        if (divOut.length) {
          eventos.push({
            id: `eir-out-${gi.checkOut.id}`,
            tipo: 'VISTORIA_EIR',
            ocorridoEm: gi.checkOut.dataHora.toISOString(),
            titulo: 'EIR — divergências na saída',
            resumo: `${divOut.length} registro(s)`,
            visibilidade: 'PUBLIC',
            fotos: asStringArray(gi.checkOut.fotosSaida),
            protocolo,
            metadata: { divergencias: mode === 'admin' ? divOut : divOut },
          });
        }

        eventos.push({
          id: `gout-${gi.checkOut.id}`,
          tipo: 'GATE_OUT',
          ocorridoEm: gi.checkOut.dataHora.toISOString(),
          titulo: 'Gate-Out / Liberação',
          resumo: 'Saída registrada',
          visibilidade: 'PUBLIC',
          protocolo,
          fotos: asStringArray(gi.checkOut.fotosSaida),
          metadata: {
            operador: gi.checkOut.operador.email,
            statusLiberacao: 'CONCLUIDO',
          },
          ric: {
            disponivel: true,
            tipo: 'SAIDA',
            gateCheckInId: gi.id,
            gateCheckOutId: gi.checkOut.id,
          },
        });
      }
    }

    if (mode === 'admin') {
      for (const pu of ctx.patioUnidades) {
        for (const mov of pu.movimentacoes) {
          eventos.push({
            id: `mov-${mov.id}`,
            tipo: 'PATIO_MOVIMENTO',
            ocorridoEm: mov.createdAt.toISOString(),
            titulo: `Pátio · ${mov.tipo.replace(/_/g, ' ')}`,
            resumo: [
              mov.origem?.codigoBaia ? `de ${mov.origem.codigoBaia}` : null,
              mov.destino?.codigoBaia ? `para ${mov.destino.codigoBaia}` : null,
            ]
              .filter(Boolean)
              .join(' '),
            visibilidade: 'ADMIN_ONLY',
            protocolo: pu.solicitacao.protocolo,
            metadata: {
              operadorEmpilhadeira: mov.operador.email,
              observacaoInterna: mov.observacao,
              baiaAtual: pu.posicaoAtual?.codigoBaia,
              statusUnidade: pu.status,
            },
          });
        }
      }
    }

    eventos.sort((a, b) => new Date(a.ocorridoEm).getTime() - new Date(b.ocorridoEm).getTime());

    const bloqueios = ctx.unidades
      .filter((u) => u.movimentacaoBloqueada)
      .map((u) => ({
        tipo: u.bloqueioTipo ?? 'OPERACIONAL',
        motivo: u.bloqueioMotivo ?? 'Movimentação bloqueada',
        origem: u.bloqueioTipo?.includes('RECEITA') || u.bloqueioTipo?.includes('MAPA')
          ? 'Receita Federal / MAPA'
          : 'Operacional RL',
      }));

    const filtered =
      mode === 'client' ? eventos.filter((e) => e.visibilidade === 'PUBLIC') : eventos;

    return {
      iso,
      isoFormatado: formatIsoDisplay(iso),
      geradoEm: new Date().toISOString(),
      eventos: filtered.map((e) =>
        mode === 'client'
          ? {
              ...e,
              ric: undefined,
              metadata: e.metadata
                ? Object.fromEntries(
                    Object.entries(e.metadata).filter(
                      ([k]) => !['operador', 'pdfHashValidado', 'motoristaCpf'].includes(k),
                    ),
                  )
                : undefined,
            }
          : e,
      ),
      ...(mode === 'admin' && bloqueios.length ? { bloqueios } : {}),
    };
  }
}
