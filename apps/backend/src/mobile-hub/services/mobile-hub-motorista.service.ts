import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { automacaoIntegracaoBus } from '../../automacao-processos/automacao-integracao.bus';
import { MobileHubOpsStore } from '../stores/mobile-hub-ops.store';
import type { MobileRequestUser } from '../types/mobile-hub.types';

@Injectable()
export class MobileHubMotoristaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ops: MobileHubOpsStore,
  ) {}

  async checkin(cx: MobileRequestUser, dto: { protocolo: string; qrPayload?: string }) {
    const proto = dto.protocolo.trim() || cx.protocoloContexto || '';
    if (!proto) throw new NotFoundException('protocolo obrigatório');
    const sol = await this.prisma.solicitacao.findFirst({
      where: { protocolo: proto, deletedAt: null },
      include: { cliente: true },
    });
    if (!sol) throw new NotFoundException('Solicitação não encontrada');
    this.ops.add({
      userId: cx.sub,
      canal: 'portaria',
      protocolo: proto,
      extras: { checkin: true, qrDigest: dto.qrPayload ? String(dto.qrPayload).slice(0, 200) : null },
    });
    automacaoIntegracaoBus.emit('integracao.evento', {
      tipo: 'solicitacao.atualizada',
      payload: { protocolo: proto, acao: 'motorista_checkin', origem: 'mobile_hub' },
      correlationId: cx.deviceId,
    });
    return {
      ok: true,
      protocolo: proto,
      status: sol.status,
      clienteNomeProxy: sol.cliente?.nome ?? null,
    };
  }

  async solicitacao(cx: MobileRequestUser, protocolo?: string) {
    const proto = (protocolo ?? cx.protocoloContexto ?? '').trim();
    if (!proto) throw new NotFoundException('Informe protocolo');
    const sol = await this.prisma.solicitacao.findFirst({
      where: { protocolo: proto, deletedAt: null },
      include: { portaria: true, gate: true, patio: true, saida: true },
    });
    if (!sol) throw new NotFoundException('Solicitação não encontrada');
    return {
      protocolo: sol.protocolo,
      status: sol.status,
      portaria: !!sol.portaria,
      gate: !!sol.gate,
      patio: sol.patio
        ? { quadra: sol.patio.quadra, fileira: sol.patio.fileira, posicao: sol.patio.posicao }
        : null,
      saida: sol.saida ? sol.saida.dataHoraSaida : null,
    };
  }
}
