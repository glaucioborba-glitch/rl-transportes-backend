import { Injectable } from '@nestjs/common';

/** Detecção simples de padrões suspeitos (memória). */
@Injectable()
export class CxPortalSecurityService {
  private readonly falhasPorIp = new Map<string, number[]>();

  registrarFalhaAuth(ip: string) {
    const now = Date.now();
    const janela = 300_000;
    const ts = (this.falhasPorIp.get(ip) ?? []).filter((t) => now - t < janela);
    ts.push(now);
    this.falhasPorIp.set(ip, ts);
  }

  ipSuspeito(ip: string): boolean {
    const ts = this.falhasPorIp.get(ip) ?? [];
    return ts.length >= 25;
  }
}
