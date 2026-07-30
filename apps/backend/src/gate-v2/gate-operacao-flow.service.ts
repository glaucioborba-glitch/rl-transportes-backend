import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AcaoAuditoria, Prisma, StatusSolicitacao } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  canTransition,
  OperacaoFluxoJson,
  OperacaoState,
  STATE_LABELS,
} from './operacao-states.constants';
import { buildQrOnApproval } from './operacao-fluxo-qr.util';
import { generateRICPDF, type RICData } from './ric-pdf.service';
import type { PassThrough } from 'stream';

const SOLICITACAO_INCLUDE = {
  cliente: true,
  portaria: true,
  gate: true,
  transporteSolicitacao: true,
  containersSolicitacao: { orderBy: { ordem: 'asc' as const } },
  agendamentoSolicitacao: true,
} satisfies Prisma.SolicitacaoInclude;

type SolicitacaoFull = Prisma.SolicitacaoGetPayload<{ include: typeof SOLICITACAO_INCLUDE }>;

@Injectable()
export class GateOperacaoFlowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private parseFluxoJson(raw: Prisma.JsonValue | null): OperacaoFluxoJson {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return raw as OperacaoFluxoJson;
  }

  private inferState(s: SolicitacaoFull): OperacaoState {
    if (s.operacaoFluxoEstado) {
      return s.operacaoFluxoEstado as OperacaoState;
    }
    if (s.status === StatusSolicitacao.REJEITADO) return 'REJEITADA';
    if (s.status === StatusSolicitacao.CONCLUIDO) return 'CONCLUIDA';
    if (s.status === StatusSolicitacao.PENDENTE || s.status === StatusSolicitacao.EM_ANALISE) {
      return 'SOLICITADA';
    }
    if (s.status === StatusSolicitacao.AGUARDANDO_GATE_IN) return 'AGUARDANDO_CHEGADA';
    if (s.status === StatusSolicitacao.EM_EXECUCAO && s.portaria) return 'VISTORIA_FOTOGRAFICA';
    if (s.status === StatusSolicitacao.EM_PATIO) return 'LIBERADA_OPERACAO';
    return 'SOLICITADA';
  }

  private async findByProtocolo(protocolo: string): Promise<SolicitacaoFull> {
    const s = await this.prisma.solicitacao.findFirst({
      where: { protocolo, deletedAt: null },
      include: SOLICITACAO_INCLUDE,
    });
    if (!s) throw new NotFoundException('Operação não encontrada');
    return s;
  }

  private containerNumero(s: SolicitacaoFull): string {
    const c = s.containersSolicitacao[0];
    return c?.unidade?.trim() || '—';
  }

  private mapOperacaoDto(s: SolicitacaoFull) {
    const fluxo = this.parseFluxoJson(s.operacaoFluxoJson);
    const state = this.inferState(s);
    const t = s.transporteSolicitacao;
    const c = s.containersSolicitacao[0];
    return {
      id: s.id,
      protocolo: s.protocolo,
      state,
      stateLabel: STATE_LABELS[state],
      etapa: state,
      containerNumero: this.containerNumero(s),
      containerTipo: c?.tipo ?? '—',
      containerTamanho: c?.tamanho ?? '—',
      containerSituacao: c?.status ?? '—',
      placa: t?.placaCavalo?.trim() || s.portaria?.placaVeiculo || '—',
      motoristaNome: t?.nomeMotorista?.trim() || s.portaria?.motoristaNome || '—',
      transportadoraNome: s.portaria?.transportadoraNome || '—',
      clienteNome: s.cliente.nomeFantasia || s.cliente.razaoSocial,
      tipoOperacao: s.tipoOperacao ?? '—',
      tatInicio: fluxo.tatInicio ?? null,
      tatFim: fluxo.tatFim ?? null,
      vistoria: fluxo.vistoria ?? null,
      qrToken: fluxo.qrToken ?? null,
      qrValidade: fluxo.qrValidade ?? null,
    };
  }

  private async transition(
    s: SolicitacaoFull,
    to: OperacaoState,
    patchJson: Partial<OperacaoFluxoJson>,
    actorUserId: string,
    extraData?: Prisma.SolicitacaoUpdateInput,
  ) {
    const from = this.inferState(s);
    if (!canTransition(from, to)) {
      throw new BadRequestException(
        `Transição inválida: ${STATE_LABELS[from]} → ${STATE_LABELS[to]}`,
      );
    }
    const prevJson = this.parseFluxoJson(s.operacaoFluxoJson);
    const nextJson = { ...prevJson, ...patchJson };

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.solicitacao.update({
        where: { id: s.id },
        data: {
          operacaoFluxoEstado: to,
          operacaoFluxoJson: nextJson as Prisma.InputJsonValue,
          ...extraData,
        },
        include: SOLICITACAO_INCLUDE,
      });
      await this.auditoria.registrar(
        {
          tabela: 'solicitacoes',
          registroId: s.id,
          acao: AcaoAuditoria.UPDATE,
          usuario: actorUserId,
          solicitacaoId: s.id,
          dadosAntes: { operacaoFluxoEstado: from },
          dadosDepois: { operacaoFluxoEstado: to },
        },
        tx,
      );
      return updated;
    });
  }

  async getOperacao(protocolo: string) {
    const s = await this.findByProtocolo(protocolo);
    return this.mapOperacaoDto(s);
  }

  async listAguardandoChegada(search?: string) {
    const where: Prisma.SolicitacaoWhereInput = {
      deletedAt: null,
      status: StatusSolicitacao.AGUARDANDO_GATE_IN,
      OR: [
        { operacaoFluxoEstado: 'AGUARDANDO_CHEGADA' },
        { operacaoFluxoEstado: null },
      ],
    };
    if (search?.trim()) {
      const q = search.trim();
      where.AND = [
        {
          OR: [
            { protocolo: { contains: q, mode: 'insensitive' } },
            { transporteSolicitacao: { placaCavalo: { contains: q, mode: 'insensitive' } } },
            { containersSolicitacao: { some: { unidade: { contains: q, mode: 'insensitive' } } } },
          ],
        },
      ];
    }
    const rows = await this.prisma.solicitacao.findMany({
      where,
      include: SOLICITACAO_INCLUDE,
      take: 50,
      orderBy: { createdAt: 'desc' },
    });
    return {
      items: rows.map((s) => ({
        protocolo: s.protocolo,
        containerNumero: this.containerNumero(s),
        containerTipo: s.containersSolicitacao[0]?.tipo ?? '—',
        placa: s.transporteSolicitacao?.placaCavalo ?? '—',
        clienteNome: s.cliente.nomeFantasia || s.cliente.razaoSocial,
      })),
    };
  }

  async checkin(protocolo: string, actorUserId: string) {
    const s = await this.findByProtocolo(protocolo);
    const state = this.inferState(s);
    if (state !== 'AGUARDANDO_CHEGADA') {
      throw new BadRequestException(
        `Check-in permitido apenas em Aguardando Chegada (atual: ${STATE_LABELS[state]})`,
      );
    }
    await this.prisma.portaria.upsert({
      where: { solicitacaoId: s.id },
      create: {
        solicitacaoId: s.id,
        placaVeiculo: s.transporteSolicitacao?.placaCavalo ?? null,
        motoristaNome: s.transporteSolicitacao?.nomeMotorista ?? null,
      },
      update: {},
    });
    const updated = await this.transition(s, 'CHECKIN_PORTARIA', {}, actorUserId, {
      status: StatusSolicitacao.EM_EXECUCAO,
    });
    return this.mapOperacaoDto(updated);
  }

  async submitVistoria(
    protocolo: string,
    body: {
      fotos: Array<{ tipo: string; imagem: string; ocrResult?: string; ocrMatch?: boolean; ocrConfianca?: number; ocrProvider?: string }>;
      avarias: Array<{ foto: string; descricao: string; localizacao: string }>;
    },
    actorUserId: string,
  ) {
    const s = await this.findByProtocolo(protocolo);
    let current = this.inferState(s);
    if (current === 'CHECKIN_PORTARIA') {
      const mid = await this.transition(s, 'VISTORIA_FOTOGRAFICA', {}, actorUserId);
      current = this.inferState(mid);
      Object.assign(s, mid);
    }
    if (current !== 'VISTORIA_FOTOGRAFICA') {
      throw new BadRequestException(
        `Vistoria permitida após check-in (atual: ${STATE_LABELS[current]})`,
      );
    }
    const obrigatorias = [
      'CONTAINER_OCR',
      'PLACA_OCR',
      'LADO_FRONTAL',
      'LADO_TRASEIRO',
      'LADO_DIREITO',
      'LADO_ESQUERDO',
    ];
    const tipos = new Set(body.fotos.map((f) => f.tipo));
    for (const t of obrigatorias) {
      if (!tipos.has(t)) {
        throw new BadRequestException(`Foto obrigatória ausente: ${t}`);
      }
    }
    const updated = await this.transition(
      s,
      'AGUARDANDO_RECONFIRMACAO',
      {
        vistoria: {
          fotos: body.fotos,
          avarias: body.avarias.map((a) => ({ ...a, timestamp: new Date().toISOString() })),
          enviadaEm: new Date().toISOString(),
        },
      },
      actorUserId,
    );
    return this.mapOperacaoDto(updated);
  }

  async getVistoria(protocolo: string) {
    return this.getOperacao(protocolo);
  }

  async reconfirmar(
    protocolo: string,
    checklist: Record<string, boolean>,
    actorUserId: string,
  ) {
    const s = await this.findByProtocolo(protocolo);
    const state = this.inferState(s);
    if (state !== 'AGUARDANDO_RECONFIRMACAO') {
      throw new BadRequestException(
        `Reconfirmação permitida após vistoria (atual: ${STATE_LABELS[state]})`,
      );
    }
    const allChecked = Object.values(checklist).every(Boolean);
    if (!allChecked) {
      throw new BadRequestException('Marque todos os itens do checklist');
    }
    const updated = await this.transition(
      s,
      'RECONFIRMADA',
      {
        reconfirmacao: {
          checklist,
          reconfirmadaEm: new Date().toISOString(),
          operadorId: actorUserId,
        },
      },
      actorUserId,
    );
    return this.mapOperacaoDto(updated);
  }

  async rejeitar(
    protocolo: string,
    motivo: string,
    etapa: string,
    actorUserId: string,
  ) {
    const s = await this.findByProtocolo(protocolo);
    const from = this.inferState(s);
    if (from === 'CONCLUIDA' || from === 'REJEITADA') {
      throw new BadRequestException('Operação já finalizada');
    }
    const prevJson = this.parseFluxoJson(s.operacaoFluxoJson);
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.solicitacao.update({
        where: { id: s.id },
        data: {
          operacaoFluxoEstado: 'REJEITADA',
          status: StatusSolicitacao.REJEITADO,
          operacaoFluxoJson: {
            ...prevJson,
            rejeicao: { motivo, etapa, rejeitadaEm: new Date().toISOString() },
          } as Prisma.InputJsonValue,
        },
        include: SOLICITACAO_INCLUDE,
      });
      await this.auditoria.registrar(
        {
          tabela: 'solicitacoes',
          registroId: s.id,
          acao: AcaoAuditoria.UPDATE,
          usuario: actorUserId,
          solicitacaoId: s.id,
          dadosDepois: { operacaoFluxoEstado: 'REJEITADA', motivo, etapa },
        },
        tx,
      );
      return u;
    });
    return this.mapOperacaoDto(updated);
  }

  async saveAssinatura(protocolo: string, assinatura: string, actorUserId: string) {
    const s = await this.findByProtocolo(protocolo);
    const state = this.inferState(s);
    if (state !== 'RECONFIRMADA' && state !== 'RIC_GERADO') {
      throw new BadRequestException('Assinatura permitida após reconfirmação');
    }
    await this.prisma.gate.upsert({
      where: { solicitacaoId: s.id },
      create: { solicitacaoId: s.id, ricAssinado: false },
      update: {},
    });
    const fluxo = this.parseFluxoJson(s.operacaoFluxoJson);
    const to: OperacaoState = state === 'RIC_GERADO' ? 'RIC_GERADO' : 'RIC_GERADO';
    const updated =
      state === 'RIC_GERADO'
        ? await this.prisma.solicitacao.update({
            where: { id: s.id },
            data: {
              operacaoFluxoJson: {
                ...fluxo,
                assinatura,
                ricGeradoEm: fluxo.ricGeradoEm ?? new Date().toISOString(),
              } as Prisma.InputJsonValue,
            },
            include: SOLICITACAO_INCLUDE,
          })
        : await this.transition(
            s,
            to,
            { assinatura, ricGeradoEm: new Date().toISOString() },
            actorUserId,
          );
    await this.prisma.gate.update({
      where: { solicitacaoId: s.id },
      data: { ricAssinado: true },
    });
    return this.mapOperacaoDto(updated);
  }

  async buildRicData(protocolo: string): Promise<RICData> {
    const s = await this.findByProtocolo(protocolo);
    const state = this.inferState(s);
    const estadosValidos: OperacaoState[] = [
      'RECONFIRMADA',
      'RIC_GERADO',
      'LIBERADA_OPERACAO',
      'EM_OPERACAO',
      'CONCLUIDA',
    ];
    if (!estadosValidos.includes(state)) {
      throw new BadRequestException(
        `RIC só pode ser gerado após reconfirmação. Estado atual: ${STATE_LABELS[state]}`,
      );
    }

    const fluxo = this.parseFluxoJson(s.operacaoFluxoJson);
    const t = s.transporteSolicitacao;
    const c = s.containersSolicitacao[0];

    let reconfirmacaoNome = '—';
    const operadorId = fluxo.reconfirmacao?.operadorId;
    if (operadorId) {
      const u = await this.prisma.user.findUnique({
        where: { id: operadorId },
        select: { email: true },
      });
      reconfirmacaoNome = u?.email ?? operadorId;
    }

    return {
      protocolo: s.protocolo,
      containerNumero: this.containerNumero(s),
      containerTipo: c?.tipo ?? '—',
      containerTamanho: c?.tamanho ?? '—',
      containerSituacao: c?.status ?? '—',
      tipoOperacao: String(s.tipoOperacao ?? '—'),
      placa: t?.placaCavalo?.trim() || s.portaria?.placaVeiculo || '—',
      motoristaNome: t?.nomeMotorista?.trim() || s.portaria?.motoristaNome || '—',
      motoristaCPF: t?.cpfMotorista?.trim() || s.portaria?.motoristaCpf || '',
      transportadoraNome: s.portaria?.transportadoraNome || '—',
      transportadoraCNPJ: '',
      clienteNome: s.cliente.nomeFantasia || s.cliente.razaoSocial,
      clienteCNPJ: s.cliente.cpfCnpj ?? '',
      vistoria: {
        fotos: fluxo.vistoria?.fotos ?? [],
        avarias: fluxo.vistoria?.avarias ?? [],
        dataVistoria: fluxo.vistoria?.enviadaEm ?? s.updatedAt.toISOString(),
        portariaResponsavel: 'Portaria RL',
      },
      reconfirmacao: {
        responsavel: reconfirmacaoNome,
        dataReconfirmacao: fluxo.reconfirmacao?.reconfirmadaEm ?? '—',
        checklist: fluxo.reconfirmacao?.checklist ?? {},
      },
      assinatura: fluxo.assinatura ?? '',
      dataAssinatura: fluxo.ricGeradoEm ?? new Date().toISOString(),
      qrToken: fluxo.qrToken ?? '',
    };
  }

  async streamRicPdf(protocolo: string): Promise<PassThrough> {
    const data = await this.buildRicData(protocolo);
    return generateRICPDF(data);
  }

  async liberarOperacao(protocolo: string, actorUserId: string) {
    const s = await this.findByProtocolo(protocolo);
    const state = this.inferState(s);
    if (state !== 'RIC_GERADO') {
      throw new BadRequestException('Liberação permitida após RIC gerado');
    }
    const updated = await this.transition(s, 'LIBERADA_OPERACAO', {}, actorUserId, {
      status: StatusSolicitacao.EM_PATIO,
    });
    return this.mapOperacaoDto(updated);
  }

  async iniciarOperacao(protocolo: string, equipamentoId: string | undefined, actorUserId: string) {
    const s = await this.findByProtocolo(protocolo);
    const state = this.inferState(s);
    if (state !== 'LIBERADA_OPERACAO') {
      throw new BadRequestException('Início permitido quando liberada para operação');
    }
    const updated = await this.transition(
      s,
      'EM_OPERACAO',
      { tatInicio: new Date().toISOString(), equipamentoId },
      actorUserId,
    );
    return this.mapOperacaoDto(updated);
  }

  async concluirOperacao(protocolo: string, actorUserId: string) {
    const s = await this.findByProtocolo(protocolo);
    const state = this.inferState(s);
    if (state !== 'EM_OPERACAO') {
      throw new BadRequestException('Conclusão permitida apenas em operação');
    }
    const fluxo = this.parseFluxoJson(s.operacaoFluxoJson);
    const updated = await this.transition(
      s,
      'CONCLUIDA',
      { ...fluxo, tatFim: new Date().toISOString() },
      actorUserId,
      { status: StatusSolicitacao.CONCLUIDO },
    );
    return this.mapOperacaoDto(updated);
  }

  async countAguardandoReconfirmacao(): Promise<number> {
    return this.prisma.solicitacao.count({
      where: { deletedAt: null, operacaoFluxoEstado: 'AGUARDANDO_RECONFIRMACAO' },
    });
  }

  async listAguardandoReconfirmacao() {
    const rows = await this.prisma.solicitacao.findMany({
      where: { deletedAt: null, operacaoFluxoEstado: 'AGUARDANDO_RECONFIRMACAO' },
      include: SOLICITACAO_INCLUDE,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return { items: rows.map((s) => this.mapOperacaoDto(s)) };
  }

  async validateQrToken(token: string) {
    const rows = await this.prisma.solicitacao.findMany({
      where: {
        deletedAt: null,
        operacaoFluxoEstado: { in: ['AGUARDANDO_CHEGADA', 'APROVADA'] },
      },
      include: SOLICITACAO_INCLUDE,
      take: 500,
    });
    for (const s of rows) {
      const fluxo = this.parseFluxoJson(s.operacaoFluxoJson);
      if (fluxo.qrToken !== token) continue;
      if (fluxo.qrValidade && new Date(fluxo.qrValidade) <= new Date()) {
        throw new BadRequestException('QR Code expirado');
      }
      return this.mapOperacaoDto(s);
    }
    throw new NotFoundException('QR Code inválido');
  }

  /** Gera token QR na aprovação (24h). */
  buildQrOnApproval(
    existingJson: OperacaoFluxoJson,
    protocolo: string,
    clienteId: string,
    container: string,
  ) {
    return buildQrOnApproval(existingJson, protocolo, clienteId, container);
  }

  async portariaStats() {
    const [aguardandoChegada, emVistoria, aguardandoGate, concluidasHoje] = await Promise.all([
      this.prisma.solicitacao.count({
        where: { deletedAt: null, operacaoFluxoEstado: 'AGUARDANDO_CHEGADA' },
      }),
      this.prisma.solicitacao.count({
        where: {
          deletedAt: null,
          operacaoFluxoEstado: { in: ['CHECKIN_PORTARIA', 'VISTORIA_FOTOGRAFICA'] },
        },
      }),
      this.prisma.solicitacao.count({
        where: { deletedAt: null, operacaoFluxoEstado: 'AGUARDANDO_RECONFIRMACAO' },
      }),
      this.prisma.solicitacao.count({
        where: {
          deletedAt: null,
          operacaoFluxoEstado: 'CONCLUIDA',
          updatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);
    return { aguardandoChegada, emVistoria, aguardandoGate, concluidasHoje };
  }
}
