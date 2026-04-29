import { Injectable } from '@nestjs/common';
import { MobileTelemetryStore } from '../../mobile-hub/stores/mobile-telemetry.store';
import type { MobileTelemetryBatch } from '../../mobile-hub/stores/mobile-telemetry.store';

@Injectable()
export class CockpitTelemetriaService {
  constructor(private readonly tel: MobileTelemetryStore) {}

  mobile() {
    const agg = this.tel.agregadoStaff();
    const recent = this.tel.ultimosJanela(300);
    const comLoc = recent.filter((b: MobileTelemetryBatch) => b.localizacao);
    return {
      geradoEm: new Date().toISOString(),
      agregado24h: agg,
      localizacoesAproximadas: comLoc.slice(0, 40).map((b: MobileTelemetryBatch) => ({
        deviceId: b.deviceId,
        userSub: b.userSub,
        mobileRole: b.mobileRole,
        lat: b.localizacao!.lat,
        lng: b.localizacao!.lng,
        em: b.recebidoEm,
      })),
      amostraLatencia: recent
        .filter((b: MobileTelemetryBatch) => b.latenciaMsMedia != null)
        .slice(0, 30)
        .map((b: MobileTelemetryBatch) => ({
          deviceId: b.deviceId,
          latenciaMs: b.latenciaMsMedia,
          em: b.recebidoEm,
        })),
      eventosCriticosAppProxy: recent
        .filter((b: MobileTelemetryBatch) => b.usoOffline || (b.errosRecorrentes?.length ?? 0) > 0)
        .slice(0, 25),
    };
  }

  dispositivos() {
    const recent = this.tel.ultimosJanela(500);
    const m = new Map<
      string,
      { deviceId: string; amostras: number; ultimaEm: string; latenciaMedia: number | null; redeMedia: number | null }
    >();
    for (const b of recent) {
      const cur = m.get(b.deviceId) ?? {
        deviceId: b.deviceId,
        amostras: 0,
        ultimaEm: b.recebidoEm,
        latenciaMedia: null,
        redeMedia: null,
      };
      cur.amostras += 1;
      if (b.recebidoEm > cur.ultimaEm) cur.ultimaEm = b.recebidoEm;
      if (b.latenciaMsMedia != null) {
        cur.latenciaMedia = cur.latenciaMedia == null ? b.latenciaMsMedia : (cur.latenciaMedia + b.latenciaMsMedia) / 2;
      }
      if (b.redeForca != null) {
        cur.redeMedia = cur.redeMedia == null ? b.redeForca : (cur.redeMedia + b.redeForca) / 2;
      }
      m.set(b.deviceId, cur);
    }
    return {
      geradoEm: new Date().toISOString(),
      totalDispositivos: m.size,
      dispositivos: [...m.values()].sort((a, b) => b.amostras - a.amostras).slice(0, 100),
    };
  }
}
