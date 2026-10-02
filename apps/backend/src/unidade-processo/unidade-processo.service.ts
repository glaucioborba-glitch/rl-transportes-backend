import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AcaoAuditoria,
  ModalidadeUnidadeProcesso,
  PatioStatus,
  Prisma,
  StatusPreFatura,
  StatusSolicitacao,
  StatusUnidadeProcesso,
  TipoOperacaoSolicitacaoIntent,
  EventoGatilhoTarifa,
} from '@prisma/client';
import { ArmazenagemBillingService } from '../armazenagem-faturamento/armazenagem-billing.service';
import { isBillingEligibleIntent } from '../billing-engine/billing-eligible-intents.util';
import { normalizeContainerIso } from '../common/utils/data-sanitize';
import { lacreTrocaPatio, textoLacreTroca } from '../common/utils/lacre-operacional.util';
import { OutboxService } from '../outbox/outbox.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PatioV2Service } from '../patio-v2/patio.service';
import { PrismaService } from '../prisma/prisma.service';
import { tipoRequerTomadaReefer } from '../cadastros/tipo-container-tomada.util';
import { rotuloTipoOperacao } from '../gate-v2/conferencia-entrada-saida.util';
import { UnidadeProcessoServicosService } from './unidade-processo-servicos.service';
import {
  isLancamentoAutomaticoExcluido,
} from './servicos-abertura-tabela.util';
import {
  type ConsultaRicFiltro,
  prismaWhereConsultaRic,
} from './consulta-ric.query';
import {
  assertCargaCompativelComIntent,
  assertLocalPortoParaCheio,
  direcaoUnidade,
  formatUnidadeProcessoId,
  isDirecaoEntrada,
  isDirecaoSaida,
} from './unidade-direcao.util';

type Db = Prisma.TransactionClient | PrismaService;

function pickContainerDaSolicitacao<T extends { unidade?: string | null }>(
  list: T[] | undefined,
  unidadeIso?: string,
): T | undefined {
  if (!list?.length) return undefined;
  if (!unidadeIso) return list[0];
  const iso = normalizeContainerIso(unidadeIso).replace(/\s/g, '').toUpperCase();
  return (
    list.find((c) => normalizeContainerIso(c.unidade ?? '').replace(/\s/g, '').toUpperCase() === iso) ??
    list[0]
  );
}

@Injectable()
export class UnidadeProcessoService {
  private readonly logger = new Logger(UnidadeProcessoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly patio: PatioV2Service,
    private readonly billing: ArmazenagemBillingService,
    private readonly outbox: OutboxService,
    private readonly servicos: UnidadeProcessoServicosService,
    @Optional() private readonly auditoria?: AuditoriaService,
  ) {}

  async findAbertoPorIso(
    unidadeIso: string,
    db: Db = this.prisma,
    opts?: { clienteId?: string; modalidade?: ModalidadeUnidadeProcesso },
  ) {
    const iso = this.normIso(unidadeIso);
    return db.unidadeProcesso.findFirst({
      where: {
        unidadeIso: iso,
        status: StatusUnidadeProcesso.ABERTO,
        modalidade: opts?.modalidade ?? ModalidadeUnidadeProcesso.PATIO,
        ...(opts?.clienteId ? { clienteId: opts.clienteId } : {}),
      },
    });
  }

  async assertPodeCriarSolicitacao(input: {
    clienteId: string;
    tenantId?: string;
    intent: TipoOperacaoSolicitacaoIntent | string;
    localOrigem?: string | null;
    localDestino?: string | null;
    containers: Array<{ unidade: string; status: string }>;
  }): Promise<void> {
    const tipoLocal = await this.resolveTipoLocal(
      input.tenantId,
      isDirecaoEntrada(input.intent) ? input.localOrigem : input.localDestino,
    );

    for (const c of input.containers) {
      const iso = this.normIso(c.unidade);
      if (!iso) continue;
      try {
        assertCargaCompativelComIntent(input.intent, c.status);
        assertLocalPortoParaCheio(input.intent, c.status, tipoLocal);
      } catch (err) {
        throw new BadRequestException((err as Error).message);
      }

      const abertoGlobal = await this.findAbertoPorIso(iso);
      const abertoDoCliente =
        abertoGlobal?.clienteId === input.clienteId ? abertoGlobal : null;
      const direcao = direcaoUnidade(input.intent);

      if (direcao === 'ENTRADA' && abertoGlobal) {
        throw new ConflictException(
          abertoDoCliente
            ? `A unidade ${iso} já está em estoque (${formatUnidadeProcessoId(abertoDoCliente.numero)}). Encerre a saída antes de nova entrada.`
            : `A unidade ${iso} já está em estoque. Encerre a saída antes de nova entrada.`,
        );
      }
      if ((direcao === 'SAIDA' || direcao === 'INTERNA') && !abertoDoCliente) {
        throw new BadRequestException(
          `A unidade ${iso} não está em estoque. Coleta/saída só é permitida com ID aberto (entrada anterior).`,
        );
      }
    }
  }

  async vincularSaidaNaTransacao(
    tx: Prisma.TransactionClient,
    solicitacaoId: string,
    intent: TipoOperacaoSolicitacaoIntent | string,
    unidades: string[],
    clienteId: string,
  ): Promise<void> {
    if (!isDirecaoSaida(intent) && direcaoUnidade(intent) !== 'INTERNA') return;
    for (const raw of unidades) {
      const iso = this.normIso(raw);
      if (!iso) continue;
      const aberto = await tx.unidadeProcesso.findFirst({
        where: {
          unidadeIso: iso,
          status: StatusUnidadeProcesso.ABERTO,
          modalidade: ModalidadeUnidadeProcesso.PATIO,
          clienteId,
        },
      });
      if (!aberto) {
        throw new BadRequestException(
          `A unidade ${iso} não está em estoque. Coleta/saída só é permitida com ID aberto (entrada anterior).`,
        );
      }
      if (isDirecaoSaida(intent) && !aberto.saidaSolicitacaoId) {
        await tx.unidadeProcesso.update({
          where: { id: aberto.id },
          data: { saidaSolicitacaoId: solicitacaoId },
        });
      }
    }
  }

  /**
   * O ID nasce na emissão da RIC (entrada) para constar no PDF.
   * Na saída, só resolve o ID aberto do estoque — não cria número novo.
   */
  async ensureIdNaEmissaoRic(solicitacaoId: string, actorUserId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const sol = await tx.solicitacao.findUnique({
        where: { id: solicitacaoId },
        include: {
          cliente: { select: { id: true, tenantId: true } },
          containersSolicitacao: { orderBy: { ordem: 'asc' } },
          gateCheckIns: { orderBy: { dataHora: 'desc' }, take: 1 },
        },
      });
      if (!sol) return;

      const intent = sol.tipoOperacao ?? '';
      const direcao = direcaoUnidade(intent);
      const gateInId = sol.gateCheckIns[0]?.id ?? null;
      const now = new Date();

      for (const c of sol.containersSolicitacao) {
        const iso = this.normIso(c.unidade);
        if (!iso) continue;

        if (direcao === 'ENTRADA') {
          const existente = await tx.unidadeProcesso.findFirst({
            where: {
              unidadeIso: iso,
              status: StatusUnidadeProcesso.ABERTO,
              modalidade: ModalidadeUnidadeProcesso.PATIO,
            },
          });
          if (existente) {
            if (existente.entradaSolicitacaoId === sol.id) continue;
            throw new ConflictException(
              `A unidade ${iso} já possui ${formatUnidadeProcessoId(existente.numero)} aberto.`,
            );
          }
          await this.abrirProcesso(tx, {
            tenantId: sol.cliente.tenantId,
            clienteId: sol.cliente.id,
            unidadeIso: iso,
            solicitacaoId: sol.id,
            protocolo: sol.protocolo,
            tipo: c.tipo,
            tamanho: c.tamanho,
            status: c.status,
            refrigerado: c.refrigerado,
            setPoint: c.setPoint,
            gateInId,
            entradaEm: now,
            actorUserId,
            intent,
          });
          continue;
        }

        const aberto = await tx.unidadeProcesso.findFirst({
          where: {
            unidadeIso: iso,
            status: StatusUnidadeProcesso.ABERTO,
            modalidade: ModalidadeUnidadeProcesso.PATIO,
            clienteId: sol.cliente.id,
          },
        });
        if (aberto && isDirecaoSaida(intent) && !aberto.saidaSolicitacaoId) {
          await tx.unidadeProcesso.update({
            where: { id: aberto.id },
            data: { saidaSolicitacaoId: sol.id },
          });
        }
      }
    });
  }

  async onLiberarOperacao(
    solicitacaoId: string,
    actorUserId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const sol = await tx.solicitacao.findUnique({
      where: { id: solicitacaoId },
      include: {
        cliente: { select: { id: true, tenantId: true } },
        containersSolicitacao: { orderBy: { ordem: 'asc' } },
        gateCheckIns: { orderBy: { dataHora: 'desc' }, take: 1 },
      },
    });
    if (!sol) return;

    const intent = sol.tipoOperacao ?? '';
    const direcao = direcaoUnidade(intent);
    const gateInId = sol.gateCheckIns[0]?.id ?? null;
    const now = new Date();

    for (const c of sol.containersSolicitacao) {
      const iso = this.normIso(c.unidade);
      if (!iso) continue;

      if (direcao === 'ENTRADA') {
        const existente = await tx.unidadeProcesso.findFirst({
          where: {
            unidadeIso: iso,
            status: StatusUnidadeProcesso.ABERTO,
            modalidade: ModalidadeUnidadeProcesso.PATIO,
          },
        });
        if (existente?.entradaSolicitacaoId === sol.id) {
          continue;
        }
        await this.abrirProcesso(tx, {
          tenantId: sol.cliente.tenantId,
          clienteId: sol.cliente.id,
          unidadeIso: iso,
          solicitacaoId: sol.id,
          protocolo: sol.protocolo,
          tipo: c.tipo,
          tamanho: c.tamanho,
          status: c.status,
          refrigerado: c.refrigerado,
          setPoint: c.setPoint,
          gateInId,
          entradaEm: now,
          actorUserId,
          intent,
        });
      } else if (direcao === 'SAIDA') {
        await this.encerrarProcesso(tx, {
          unidadeIso: iso,
          clienteId: sol.cliente.id,
          saidaSolicitacaoId: sol.id,
          saidaEm: now,
          actorUserId,
          intent,
        });
      }
    }
  }

  private async abrirProcesso(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string;
      clienteId: string;
      unidadeIso: string;
      solicitacaoId: string;
      protocolo?: string | null;
      tipo?: string | null;
      tamanho?: string | null;
      status?: string | null;
      refrigerado: boolean;
      setPoint: number | null;
      gateInId: string | null;
      entradaEm: Date;
      actorUserId: string;
      intent: string;
    },
  ) {
    const existente = await tx.unidadeProcesso.findFirst({
      where: {
        unidadeIso: input.unidadeIso,
        status: StatusUnidadeProcesso.ABERTO,
        modalidade: ModalidadeUnidadeProcesso.PATIO,
      },
    });
    if (existente) {
      throw new ConflictException(
        `A unidade ${input.unidadeIso} já possui ${formatUnidadeProcessoId(existente.numero)} aberto.`,
      );
    }

    const rows = await tx.$queryRaw<Array<{ n: bigint | number }>>`
      SELECT nextval('unidade_processos_numero_seq') AS n
    `;
    const numero = Number(rows[0]?.n ?? 0);
    const processo = await tx.unidadeProcesso.create({
      data: {
        tenantId: input.tenantId,
        numero,
        unidadeIso: input.unidadeIso,
        clienteId: input.clienteId,
        status: StatusUnidadeProcesso.ABERTO,
        modalidade: ModalidadeUnidadeProcesso.PATIO,
        entradaEm: input.entradaEm,
        entradaSolicitacaoId: input.solicitacaoId,
      },
    });

    await this.patio.provisionFromProcesso(
      {
        unidadeProcessoId: processo.id,
        solicitacaoId: input.solicitacaoId,
        unidadeIso: input.unidadeIso,
        refrigerado: input.refrigerado,
        setPoint: input.setPoint,
        gateInId: input.gateInId,
      },
      tx,
    );

    await this.servicos.aplicarNaAbertura(tx, {
      processoId: processo.id,
      clienteId: input.clienteId,
      tipo: input.tipo,
      tamanho: input.tamanho,
      status: input.status,
      refrigerado: input.refrigerado,
      userId: input.actorUserId,
    });

    if (isBillingEligibleIntent(input.intent as TipoOperacaoSolicitacaoIntent)) {
      try {
        await this.billing.openPreFaturasForProcesso(
          {
            unidadeProcessoId: processo.id,
            clienteId: input.clienteId,
            entradaEm: input.entradaEm,
            gateInId: input.gateInId,
            containerHint: {
              tipo: input.tipo,
              tamanho: input.tamanho,
              status: input.status,
              refrigerado: input.refrigerado,
              setPoint: input.setPoint,
            },
          },
          tx,
        );
      } catch (err) {
        if (err instanceof UnprocessableEntityException) {
          this.logger.warn(
            `${formatUnidadeProcessoId(processo.numero)} aberto sem pré-fatura: ${err.message}`,
          );
        } else {
          throw err;
        }
      }
    }

    await this.outbox.enqueue(tx, {
      aggregateType: 'UnidadeProcesso',
      aggregateId: processo.id,
      eventType: 'UNIDADE_PROCESSO_ABERTO',
      payload: {
        unidadeProcessoId: processo.id,
        numero: processo.numero,
        unidadeIso: input.unidadeIso,
        clienteId: input.clienteId,
        tenantId: input.tenantId,
        solicitacaoId: input.solicitacaoId,
        actorUserId: input.actorUserId,
      },
    });

    await this.auditoria?.registrar(
      {
        tabela: 'unidade_processos',
        registroId: processo.id,
        acao: AcaoAuditoria.INSERT,
        usuario: input.actorUserId,
        solicitacaoId: input.solicitacaoId,
        dadosDepois: {
          numero: processo.numero,
          protocolo: input.protocolo ?? null,
          unidadeIso: input.unidadeIso,
          controlePrincipal: formatUnidadeProcessoId(processo.numero),
          controleSecundario: input.protocolo ? `Protocolo ${input.protocolo}` : undefined,
        },
      },
      tx,
    );
  }

  private async encerrarProcesso(
    tx: Prisma.TransactionClient,
    input: {
      unidadeIso: string;
      clienteId: string;
      saidaSolicitacaoId: string;
      saidaEm: Date;
      actorUserId: string;
      intent: string;
    },
  ) {
    const aberto = await tx.unidadeProcesso.findFirst({
      where: {
        unidadeIso: input.unidadeIso,
        status: StatusUnidadeProcesso.ABERTO,
        modalidade: ModalidadeUnidadeProcesso.PATIO,
        clienteId: input.clienteId,
      },
    });
    if (!aberto) {
      throw new BadRequestException(
        `A unidade ${input.unidadeIso} não está em estoque. Não há ID aberto para encerrar.`,
      );
    }

    await tx.unidadeProcesso.update({
      where: { id: aberto.id },
      data: {
        status: StatusUnidadeProcesso.ENCERRADO,
        saidaEm: input.saidaEm,
        saidaSolicitacaoId: input.saidaSolicitacaoId,
      },
    });

    await this.patio.finalizeFromProcesso(aberto.id, input.actorUserId, tx);
    await this.servicos.sincronizarTomadaNaSaida(tx, aberto.id, input.saidaEm, input.actorUserId);

    if (isBillingEligibleIntent(input.intent as TipoOperacaoSolicitacaoIntent)) {
      await this.billing.consolidateOnProcesso(aberto.id, input.saidaEm, tx);
    }

    await this.outbox.enqueue(tx, {
      aggregateType: 'UnidadeProcesso',
      aggregateId: aberto.id,
      eventType: 'UNIDADE_PROCESSO_ENCERRADO',
      payload: {
        unidadeProcessoId: aberto.id,
        numero: aberto.numero,
        unidadeIso: input.unidadeIso,
        clienteId: input.clienteId,
        tenantId: aberto.tenantId,
        saidaSolicitacaoId: input.saidaSolicitacaoId,
        actorUserId: input.actorUserId,
      },
    });
  }

  /**
   * Anula a perna da RIC (entrada ou saída) com autorização de gerente.
   * Entrada só se o ID ainda estiver aberto e sem fatura.
   * Saída reabre o ID no pátio.
   */
  async anularAposRic(solicitacaoId: string, _gerenteId: string): Promise<{
    direcao: 'ENTRADA' | 'SAIDA';
    unidadeProcessoId: string;
    numero: number;
  }> {
    return this.prisma.$transaction(async (tx) => {
      const sol = await tx.solicitacao.findFirst({
        where: { id: solicitacaoId, deletedAt: null },
        include: { cliente: { select: { id: true, tenantId: true } } },
      });
      if (!sol) {
        throw new BadRequestException('Operação não encontrada.');
      }
      const direcao = direcaoUnidade(sol.tipoOperacao ?? '');
      if (direcao !== 'ENTRADA' && direcao !== 'SAIDA') {
        throw new BadRequestException('Só é possível excluir RIC de entrada ou saída.');
      }

      const up = await tx.unidadeProcesso.findFirst({
        where:
          direcao === 'ENTRADA'
            ? { entradaSolicitacaoId: sol.id }
            : { saidaSolicitacaoId: sol.id },
      });
      if (!up) {
        throw new BadRequestException('Esta RIC ainda não gerou ID — nada a excluir.');
      }

      const prefaturas = await tx.preFatura.findMany({
        where: { unidadeProcessoId: up.id },
        include: { fatura: { select: { id: true } } },
      });
      if (prefaturas.some((p) => p.fatura)) {
        throw new ConflictException(
          'Há fatura emitida neste ID. Exclusão bloqueada — trate no financeiro.',
        );
      }

      if (direcao === 'ENTRADA') {
        if (up.status === StatusUnidadeProcesso.ENCERRADO || up.saidaSolicitacaoId) {
          throw new ConflictException(
            'Este ID já tem saída. Anule a RIC de saída antes da entrada.',
          );
        }
        const pfIds = prefaturas.map((p) => p.id);
        if (pfIds.length) {
          await tx.itemFaturaArmazenagem.deleteMany({
            where: { preFaturaId: { in: pfIds } },
          });
          await tx.preFatura.deleteMany({ where: { id: { in: pfIds } } });
        }
        await tx.patioUnidade.updateMany({
          where: { OR: [{ unidadeProcessoId: up.id }, { solicitacaoId: sol.id }] },
          data: { posicaoAtualId: null },
        });
        await tx.patioUnidade.deleteMany({
          where: { OR: [{ unidadeProcessoId: up.id }, { solicitacaoId: sol.id }] },
        });
        await tx.unidadeProcesso.delete({ where: { id: up.id } });
      } else {
        await tx.unidadeProcesso.update({
          where: { id: up.id },
          data: {
            status: StatusUnidadeProcesso.ABERTO,
            saidaEm: null,
            saidaSolicitacaoId: null,
          },
        });
        await tx.patioUnidade.updateMany({
          where: { unidadeProcessoId: up.id },
          data: { status: PatioStatus.SEPARADO },
        });
        await tx.preFatura.updateMany({
          where: { unidadeProcessoId: up.id, status: StatusPreFatura.CONSOLIDADA },
          data: { status: StatusPreFatura.ABERTA },
        });
      }

      await tx.solicitacao.update({
        where: { id: sol.id },
        data: {
          deletedAt: new Date(),
          status: StatusSolicitacao.CANCELADO,
        },
      });

      return { direcao, unidadeProcessoId: up.id, numero: up.numero };
    });
  }

  async listConsultaRic(tenantId: string, filtro: ConsultaRicFiltro) {
    const where = prismaWhereConsultaRic(tenantId, filtro);
    const rows = await this.prisma.unidadeProcesso.findMany({
      where,
      include: {
        cliente: { select: { nomeFantasia: true, razaoSocial: true } },
        entradaSolicitacao: {
          select: {
            protocolo: true,
            tipoOperacao: true,
            cliente: { select: { nomeFantasia: true, razaoSocial: true } },
            transporteSolicitacao: {
              select: { placaCavalo: true, placaCarreta01: true, nomeMotorista: true },
            },
            containersSolicitacao: {
              orderBy: { ordem: 'asc' },
              select: {
                unidade: true,
                tipo: true,
                tamanho: true,
                booking: true,
                processo: true,
                navio: true,
                status: true,
                lacre: true,
              },
            },
          },
        },
        saidaSolicitacao: {
          select: {
            protocolo: true,
            tipoOperacao: true,
            transporteSolicitacao: {
              select: { placaCavalo: true, placaCarreta01: true, nomeMotorista: true },
            },
            containersSolicitacao: {
              orderBy: { ordem: 'asc' },
              select: {
                unidade: true,
                tipo: true,
                tamanho: true,
                booking: true,
                processo: true,
                navio: true,
                status: true,
                lacre: true,
              },
            },
          },
        },
        patioUnidades: {
          select: { refrigerado: true, unidadeIso: true },
          orderBy: { updatedAt: 'desc' },
        },
        servicosLancados: {
          where: { codigo: { equals: 'HANDLING', mode: 'insensitive' } },
          select: { valorTotal: true, payload: true },
          take: 1,
        },
        preFaturas: {
          where: { status: StatusPreFatura.ABERTA },
          select: {
            valorAcumulado: true,
            itens: {
              where: { eventoGatilho: EventoGatilhoTarifa.HANDLING },
              select: { valorTotal: true },
            },
          },
          take: 1,
        },
      },
      orderBy: [{ entradaEm: 'desc' }, { numero: 'desc' }],
      take: 200,
    });

    const tipos = await this.prisma.cadastroTipoContainer.findMany({
      where: { deletedAt: null, ativo: true },
      select: { codigo: true, tomadaReefer: true },
    });

    return {
      items: rows.map((row) => {
        const form =
          pickContainerDaSolicitacao(row.entradaSolicitacao?.containersSolicitacao, row.unidadeIso) ??
          pickContainerDaSolicitacao(row.saidaSolicitacao?.containersSolicitacao, row.unidadeIso);
        const patioU =
          row.patioUnidades.find((p) => p.unidadeIso === row.unidadeIso) ?? row.patioUnidades[0];
        const handlingExcluido = isLancamentoAutomaticoExcluido(row.servicosLancados[0]?.payload);
        const handlingServico = handlingExcluido ? 0 : Number(row.servicosLancados[0]?.valorTotal ?? 0);
        const handlingPf = handlingExcluido ? 0 : Number(row.preFaturas[0]?.itens[0]?.valorTotal ?? 0);
        const valorLancado = Number(row.preFaturas[0]?.valorAcumulado ?? 0);
        const lacreEntrada = form?.lacre ?? null;
        const troca = lacreTrocaPatio({
          lacreEntrada,
          lacreSaida: row.lacreSaida,
          observacao: row.lacreSaidaObservacao,
          origem: row.lacreSaidaOrigem,
        });
        return {
          id: row.id,
          numero: row.numero,
          label: formatUnidadeProcessoId(row.numero),
          unidadeIso: row.unidadeIso,
          status: row.status,
          tipoContainer: form?.tipo ?? null,
          tamanhoContainer: form?.tamanho ?? null,
          situacao: form?.status ?? null,
          lacre: troca?.atual ?? lacreEntrada?.trim() ?? null,
          lacreTroca: troca ? { ...troca, texto: textoLacreTroca(troca) } : null,
          tomadaReefer: tipoRequerTomadaReefer(tipos, form?.tipo),
          tomadaConectada: patioU?.refrigerado === true,
          handlingValor: handlingPf || handlingServico,
          valorLancado,
          clienteNome: row.cliente.nomeFantasia || row.cliente.razaoSocial,
          titularNome: row.cliente.nomeFantasia || row.cliente.razaoSocial,
          solicitanteNome:
            row.entradaSolicitacao?.cliente.nomeFantasia ||
            row.entradaSolicitacao?.cliente.razaoSocial ||
            row.cliente.nomeFantasia ||
            row.cliente.razaoSocial,
          entrada: this.mapConsultaRicLeg(row.entradaEm, row.entradaSolicitacao, row.unidadeIso),
          saida: row.saidaEm
            ? this.mapConsultaRicLeg(row.saidaEm, row.saidaSolicitacao, row.unidadeIso)
            : null,
        };
      }),
    };
  }

  private mapConsultaRicLeg(
    em: Date,
    sol: {
      protocolo: string;
      tipoOperacao: string | null;
      transporteSolicitacao: {
        placaCavalo: string | null;
        placaCarreta01: string | null;
        nomeMotorista: string | null;
      } | null;
      containersSolicitacao: Array<{
        unidade?: string | null;
        tipo?: string | null;
        booking: string | null;
        processo: string | null;
        navio: string | null;
        status: string | null;
      }>;
    } | null,
    unidadeIso?: string,
  ) {
    const c = pickContainerDaSolicitacao(sol?.containersSolicitacao, unidadeIso);
    const t = sol?.transporteSolicitacao;
    return {
      em: em.toISOString(),
      protocolo: sol?.protocolo ?? '',
      operacao: rotuloTipoOperacao(sol?.tipoOperacao),
      motorista: t?.nomeMotorista?.trim() || '—',
      placaCavalo: t?.placaCavalo?.trim() || '—',
      placaCarreta: t?.placaCarreta01?.trim() || '—',
      booking: c?.booking?.trim() || '—',
      processo: c?.processo?.trim() || '—',
      navio: c?.navio?.trim() || '—',
      situacao: c?.status ?? '—',
    };
  }

  /** Pátio ativo sem ID + OS de saída cujo ISO não tem estoque do mesmo cliente. */
  async relatorioEstoqueLegado(tenantId: string) {
    const patioSemId = await this.prisma.patioUnidade.findMany({
      where: {
        unidadeProcessoId: null,
        status: { in: [PatioStatus.ESTOCADO, PatioStatus.MOVIMENTANDO, PatioStatus.SEPARADO] },
        solicitacao: { tenantId, deletedAt: null },
      },
      select: {
        id: true,
        unidadeIso: true,
        status: true,
        solicitacao: { select: { id: true, protocolo: true, clienteId: true } },
      },
      take: 200,
      orderBy: { createdAt: 'desc' },
    });

    const sols = await this.prisma.solicitacao.findMany({
      where: {
        tenantId,
        deletedAt: null,
        tipoOperacao: {
          in: [
            TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA,
            TipoOperacaoSolicitacaoIntent.SOLICITAR_EXPORTACAO_ENTREGA_DEPOT,
          ],
        },
        status: {
          notIn: [
            StatusSolicitacao.CONCLUIDO,
            StatusSolicitacao.REJEITADO,
            StatusSolicitacao.CANCELADO,
            StatusSolicitacao.CANCELADO_CLIENTE,
          ],
        },
      },
      select: {
        id: true,
        protocolo: true,
        clienteId: true,
        status: true,
        tipoOperacao: true,
        containersSolicitacao: { select: { unidade: true } },
      },
      take: 300,
      orderBy: { createdAt: 'desc' },
    });

    const abertos = await this.prisma.unidadeProcesso.findMany({
      where: { tenantId, status: StatusUnidadeProcesso.ABERTO },
      select: { unidadeIso: true, clienteId: true },
    });
    const abertoKeys = new Set(abertos.map((a) => `${a.clienteId}:${a.unidadeIso}`));

    const coletasSemEstoque: Array<{
      solicitacaoId: string;
      protocolo: string;
      clienteId: string;
      status: StatusSolicitacao;
      unidadeIso: string;
    }> = [];

    for (const sol of sols) {
      for (const c of sol.containersSolicitacao) {
        const iso = this.normIso(c.unidade);
        if (!iso) continue;
        if (!abertoKeys.has(`${sol.clienteId}:${iso}`)) {
          coletasSemEstoque.push({
            solicitacaoId: sol.id,
            protocolo: sol.protocolo,
            clienteId: sol.clienteId,
            status: sol.status,
            unidadeIso: iso,
          });
        }
      }
    }

    return {
      geradoEm: new Date().toISOString(),
      tenantId,
      patioSemId: patioSemId.map((p) => ({
        patioUnidadeId: p.id,
        unidadeIso: p.unidadeIso,
        statusPatio: p.status,
        solicitacaoId: p.solicitacao.id,
        protocolo: p.solicitacao.protocolo,
        clienteId: p.solicitacao.clienteId,
      })),
      coletasSemEstoque,
    };
  }

  private async resolveTipoLocal(
    tenantId: string | undefined,
    local: string | null | undefined,
  ): Promise<string | null> {
    const nome = local?.trim();
    if (!nome) return null;
    const row = await this.prisma.cadastroLocalTransporte.findFirst({
      where: {
        deletedAt: null,
        ativo: true,
        ...(tenantId ? { tenantId } : {}),
        OR: [
          { codigo: { equals: nome, mode: 'insensitive' } },
          { nome: { equals: nome, mode: 'insensitive' } },
        ],
      },
      select: { tipo: true },
    });
    return row?.tipo ?? null;
  }

  private normIso(raw: string): string {
    return normalizeContainerIso(raw).replace(/\s/g, '').toUpperCase();
  }
}
