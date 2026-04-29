import { Injectable, NotFoundException } from '@nestjs/common';
import { AcaoAuditoria } from '@prisma/client';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { PrismaService } from '../../prisma/prisma.service';
import { automacaoIntegracaoBus } from '../../automacao-processos/automacao-integracao.bus';
import { digestBase64Payload } from '../../integracao-mobilidade/common/integracao-string.util';
import { MobileHubOpsStore, type MobileHubCanal } from '../stores/mobile-hub-ops.store';
import { MobilePushStore } from '../stores/mobile-push.store';
import type { MobileRequestUser } from '../types/mobile-hub.types';

@Injectable()
export class MobileHubOperadorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ops: MobileHubOpsStore,
    private readonly auditoria: AuditoriaService,
    private readonly push: MobilePushStore,
  ) {}

  minhasOperacoes(userId: string) {
    return this.ops.porUsuario(userId);
  }

  turno(userId: string) {
    return {
      operadorSub: userId,
      turnoId: `mturn_${new Date().toISOString().slice(0, 10)}`,
      status: 'ativo',
    };
  }

  private async resolverSolicitacao(protocolo?: string) {
    if (!protocolo?.trim()) throw new NotFoundException('protocolo obrigatório');
    const sol = await this.prisma.solicitacao.findFirst({
      where: { protocolo: protocolo.trim(), deletedAt: null },
    });
    if (!sol) throw new NotFoundException('Solicitação não encontrada');
    return sol;
  }

  async gateIn(cx: MobileRequestUser, dto: { protocolo: string; imagemBase64?: string }) {
    const sol = await this.resolverSolicitacao(dto.protocolo);
    await this.prisma.gate.upsert({
      where: { solicitacaoId: sol.id },
      create: { solicitacaoId: sol.id, ricAssinado: false },
      update: { updatedAt: new Date() },
    });
    const digest = digestBase64Payload(dto.imagemBase64);
    const entry = this.ops.add({
      userId: cx.prismaUserId ?? cx.sub,
      canal: 'gate_in',
      protocolo: dto.protocolo,
      imagemBase64: dto.imagemBase64,
      extras: { solId: sol.id },
    });
    automacaoIntegracaoBus.emit('integracao.evento', {
      tipo: 'gate.registrado',
      payload: { protocolo: dto.protocolo, origem: 'mobile_hub', digest, solicitacaoId: sol.id },
      correlationId: cx.deviceId,
    });
    this.push.enfileirar({
      tipo: 'gate_autorizado',
      destinoSub: cx.sub,
      deviceId: cx.deviceId,
      titulo: 'Gate-in registrado',
      corpo: dto.protocolo,
      meta: { entryId: entry.id },
    });
    await this.audMobile(cx, 'gate_in', entry.id);
    return { ok: true, opId: entry.id, protocolo: dto.protocolo };
  }

  async gateOut(cx: MobileRequestUser, dto: { protocolo: string; imagemBase64?: string }) {
    const sol = await this.resolverSolicitacao(dto.protocolo);
    await this.prisma.saida.upsert({
      where: { solicitacaoId: sol.id },
      create: { solicitacaoId: sol.id, dataHoraSaida: new Date() },
      update: { dataHoraSaida: new Date() },
    });
    const entry = this.ops.add({
      userId: cx.prismaUserId ?? cx.sub,
      canal: 'gate_out',
      protocolo: dto.protocolo,
      imagemBase64: dto.imagemBase64,
    });
    automacaoIntegracaoBus.emit('integracao.evento', {
      tipo: 'saida.registrada',
      payload: { protocolo: dto.protocolo, origem: 'mobile_hub', solicitacaoId: sol.id },
      correlationId: cx.deviceId,
    });
    this.push.enfileirar({
      tipo: 'container_chamado',
      destinoSub: cx.sub,
      titulo: 'Saída registrada',
      corpo: dto.protocolo,
    });
    await this.audMobile(cx, 'gate_out', entry.id);
    return { ok: true, opId: entry.id, protocolo: dto.protocolo };
  }

  async patioEvento(
    cx: MobileRequestUser,
    dto: { protocolo: string; quadra: string; fileira: string; posicao: string; imagemBase64?: string },
  ) {
    const sol = await this.resolverSolicitacao(dto.protocolo);
    await this.prisma.patio.upsert({
      where: { solicitacaoId: sol.id },
      create: {
        solicitacaoId: sol.id,
        quadra: dto.quadra,
        fileira: dto.fileira,
        posicao: dto.posicao,
      },
      update: { quadra: dto.quadra, fileira: dto.fileira, posicao: dto.posicao },
    });
    const entry = this.ops.add({
      userId: cx.prismaUserId ?? cx.sub,
      canal: 'patio',
      protocolo: dto.protocolo,
      imagemBase64: dto.imagemBase64,
      extras: { quadra: dto.quadra, fileira: dto.fileira, posicao: dto.posicao },
    });
    automacaoIntegracaoBus.emit('integracao.evento', {
      tipo: 'patio.movimentado',
      payload: {
        protocolo: dto.protocolo,
        quadra: dto.quadra,
        fileira: dto.fileira,
        posicao: dto.posicao,
        origem: 'mobile_hub',
      },
      correlationId: cx.deviceId,
    });
    await this.audMobile(cx, 'patio', entry.id);
    return { ok: true, opId: entry.id, protocolo: dto.protocolo };
  }

  async registrarCanalLeve(userId: string, canal: MobileHubCanal, dto: { protocolo?: string; imagemBase64?: string }) {
    return this.ops.add({ userId, canal, protocolo: dto.protocolo, imagemBase64: dto.imagemBase64 });
  }

  private async audMobile(cx: MobileRequestUser, rota: string, registroId: string) {
    try {
      await this.auditoria.registrar({
        tabela: 'mobile_hub_ops',
        registroId,
        acao: AcaoAuditoria.SEGURANCA,
        usuario: cx.prismaUserId ?? cx.sub,
        dadosDepois: {
          MOBILE_ACTION: true,
          rota,
          mobileRole: cx.mobileRole,
          deviceId: cx.deviceId,
        },
      });
    } catch {
      /* FK motorista: ignorar */
    }
  }
}
