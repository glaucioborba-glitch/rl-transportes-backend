import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import type { DeviceRequestHeaders } from './session.types';

const HDR_FP = 'x-device-fingerprint';
const HDR_OS = 'x-device-os';
const HDR_BROWSER = 'x-device-browser';
const HDR_TZ = 'x-device-timezone';
const HDR_SCREEN = 'x-device-screen';

@Injectable()
export class DeviceService {
  extractHeaders(req: Request): DeviceRequestHeaders {
    const h = req.headers;
    const pick = (name: string): string | undefined => {
      const v = h[name];
      if (Array.isArray(v)) return v[0]?.trim();
      return typeof v === 'string' ? v.trim() : undefined;
    };
    return {
      clientFingerprint: pick(HDR_FP),
      deviceOs: pick(HDR_OS),
      deviceBrowser: pick(HDR_BROWSER),
      deviceTimezone: pick(HDR_TZ),
      deviceScreen: pick(HDR_SCREEN),
    };
  }

  /** IPv4: mantém /24 aproximado; IPv6: primeiros 4 grupos. */
  anonymizeIp(ipRaw: string | undefined): string {
    const ip = (ipRaw || '').replace(/^::ffff:/, '').trim();
    if (!ip || ip === '::1' || ip === '127.0.0.1') return 'loopback';
    if (ip.includes('.')) {
      const p = ip.split('.');
      if (p.length >= 3) return `${p[0]}.${p[1]}.${p[2]}.0`;
      return ip;
    }
    if (ip.includes(':')) {
      const parts = ip.split(':').filter(Boolean);
      return parts.slice(0, 4).join(':') + '::';
    }
    return 'unknown';
  }

  /**
   * Hash determinístico SHA-256 para vínculo sessão/dispositivo.
   * Combina IP anonimizado, UA, SO, timezone, fingerprint do client e resolução opcional.
   */
  computeFingerprint(
    ip: string | undefined,
    ua: string | undefined,
    hdr: DeviceRequestHeaders,
    deviceIdExtra?: string,
  ): string {
    const parts = [
      this.anonymizeIp(ip),
      (ua || '').slice(0, 512),
      (hdr.deviceOs || '').slice(0, 128),
      (hdr.deviceTimezone || '').slice(0, 64),
      (hdr.clientFingerprint || '').slice(0, 256),
      (hdr.deviceScreen || '').slice(0, 32),
      (deviceIdExtra || '').slice(0, 64),
    ];
    return createHash('sha256').update(parts.join('|'), 'utf8').digest('hex');
  }

  /** desktop | mobile | tablet | unknown — UA simples. */
  deviceTypeFromUa(ua: string | undefined): string {
    const s = (ua || '').toLowerCase();
    if (!s) return 'unknown';
    if (/tablet|ipad/.test(s)) return 'tablet';
    if (/mobile|android|iphone|ipod/.test(s)) return 'mobile';
    return 'desktop';
  }
}
