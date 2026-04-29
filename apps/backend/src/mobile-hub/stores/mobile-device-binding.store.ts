import { Injectable } from '@nestjs/common';

/** Device binding (anti‑replay fraco; memória). */
@Injectable()
export class MobileDeviceBindingStore {
  private readonly deviceToSub = new Map<string, string>();
  private readonly subDevices = new Map<string, Set<string>>();

  registrar(sub: string, deviceId: string) {
    const norm = deviceId.trim();
    this.deviceToSub.set(norm, sub);
    if (!this.subDevices.has(sub)) this.subDevices.set(sub, new Set());
    this.subDevices.get(sub)!.add(norm);
  }

  dispositivosDoUsuario(sub: string): string[] {
    return [...(this.subDevices.get(sub) ?? [])];
  }

  dispositivoLiberado(deviceId: string, sub: string): boolean {
    const d = deviceId.trim();
    const owner = this.deviceToSub.get(d);
    return owner === sub;
  }
}
