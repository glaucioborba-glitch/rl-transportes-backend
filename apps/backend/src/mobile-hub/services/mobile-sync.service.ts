import { ForbiddenException, Injectable } from '@nestjs/common';
import type { MobileRequestUser } from '../types/mobile-hub.types';
import type { OfflineOpType } from '../stores/mobile-offline-sync.store';
import { MobileOfflineSyncStore } from '../stores/mobile-offline-sync.store';
import { MobileHubOperadorService } from './mobile-hub-operador.service';
import { MobileHubMotoristaService } from './mobile-hub-motorista.service';
import { MobileTelemetryStore } from '../stores/mobile-telemetry.store';

@Injectable()
export class MobileSyncService {
  constructor(
    private readonly store: MobileOfflineSyncStore,
    private readonly operador: MobileHubOperadorService,
    private readonly motorista: MobileHubMotoristaService,
    private readonly tel: MobileTelemetryStore,
  ) {}

  enfileirar(
    cx: MobileRequestUser,
    op: OfflineOpType,
    body: Record<string, unknown>,
    clientTs: number,
  ) {
    this.assertPode(cx, op);
    return this.store.enfileirar({
      deviceId: cx.deviceId,
      userSub: cx.sub,
      op,
      body,
      clientTs: clientTs || Date.now(),
    });
  }

  /** Flush: replica eventos pendentes (LWW por op+protocolo implícito no processamento sequencial). */
  async flush(cx: MobileRequestUser, ids?: string[]) {
    const pendentes = this.store
      .listarPendentes(cx.deviceId)
      .filter((e) => (ids?.length ? ids.includes(e.id) : true));

    const grupos = new Map<string, typeof pendentes>();
    for (const e of pendentes) {
      this.assertPode(cx, e.op);
      const proto = String(e.body.protocolo ?? e.op);
      const k = `${e.op}:${proto}`;
      const arr = grupos.get(k) ?? [];
      arr.push(e);
      grupos.set(k, arr);
    }

    const aplicados: string[] = [];
    for (const [, arr] of grupos) {
      const vencedor = this.store.resolverLww(arr);
      try {
        await this.aplicar(cx, vencedor.op, vencedor.body);
        aplicados.push(...arr.map((x) => x.id));
        for (const x of arr) {
          if (x.id !== vencedor.id) x.conflictResolved = `lww:${vencedor.id}`;
        }
      } catch {
        /* mantém pendente */
      }
    }
    this.store.marcarSincronizado(aplicados);
    return { sincronizados: aplicados.length, ids: aplicados };
  }

  private assertPode(cx: MobileRequestUser, op: OfflineOpType) {
    const r = cx.mobileRole;
    if (op === 'gate_in' || op === 'gate_out' || op === 'patio' || op === 'portaria') {
      if (r !== 'OPERADOR_MOBILE') {
        throw new ForbiddenException('Operação exclusiva do app operador');
      }
      return;
    }
    if (op === 'checkin_motorista') {
      if (r !== 'MOTORISTA') {
        throw new ForbiddenException('Operação exclusiva do motorista');
      }
      return;
    }
    if (op === 'telemetria_batch') {
      return;
    }
  }

  private async aplicar(cx: MobileRequestUser, op: OfflineOpType, body: Record<string, unknown>) {
    const s = (k: string) => (body[k] != null ? String(body[k]) : '');
    switch (op) {
      case 'gate_in':
        await this.operador.gateIn(cx, { protocolo: s('protocolo'), imagemBase64: body.imagemBase64 as string | undefined });
        break;
      case 'gate_out':
        await this.operador.gateOut(cx, { protocolo: s('protocolo'), imagemBase64: body.imagemBase64 as string | undefined });
        break;
      case 'patio':
        await this.operador.patioEvento(cx, {
          protocolo: s('protocolo'),
          quadra: s('quadra'),
          fileira: s('fileira'),
          posicao: s('posicao'),
          imagemBase64: body.imagemBase64 as string | undefined,
        });
        break;
      case 'portaria':
        await this.operador.registrarCanalLeve(cx.prismaUserId ?? cx.sub, 'portaria', {
          protocolo: s('protocolo') || undefined,
          imagemBase64: body.imagemBase64 as string | undefined,
        });
        break;
      case 'checkin_motorista':
        await this.motorista.checkin(cx, {
          protocolo: s('protocolo'),
          qrPayload: body.qrPayload as string | undefined,
        });
        break;
      case 'telemetria_batch': {
        const loc = body.localizacao as { lat?: number; lng?: number; precisaoM?: number } | undefined;
        this.tel.registrar({
          deviceId: cx.deviceId,
          userSub: cx.sub,
          mobileRole: cx.mobileRole,
          localizacao:
            loc && typeof loc.lat === 'number' && typeof loc.lng === 'number'
              ? { lat: loc.lat, lng: loc.lng, precisaoM: loc.precisaoM }
              : undefined,
          redeForca: body.redeForca as number | undefined,
          latenciaMsMedia: body.latenciaMsMedia as number | undefined,
          errosRecorrentes: body.errosRecorrentes as string[] | undefined,
          usoOffline: body.usoOffline as boolean | undefined,
        });
        break;
      }
      default:
        break;
    }
  }
}
