import { randomUUID } from 'crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

export type MotoristaIdentity = {
  id: string;
  email: string;
  passwordHash: string;
  protocoloPadrao: string;
  tokenVersion: number;
};

@Injectable()
export class MobileMotoristaIdentitiesStore implements OnModuleInit {
  private readonly logger = new Logger(MobileMotoristaIdentitiesStore.name);
  private readonly byEmail = new Map<string, MotoristaIdentity>();

  async onModuleInit() {
    const raw = process.env.MOBILE_MOTORISTA_SEED?.trim();
    if (!raw) return;
    for (const line of raw.split(/[\n;]+/).map((s) => s.trim()).filter(Boolean)) {
      const [email, password, protocolo] = line.split('|').map((s) => s.trim());
      if (!email || !password) continue;
      const hash = await bcrypt.hash(password, 10);
      const id = randomUUID();
      this.byEmail.set(email.toLowerCase(), {
        id,
        email: email.toLowerCase(),
        passwordHash: hash,
        protocoloPadrao: protocolo || 'PROT-DEFAULT',
        tokenVersion: 0,
      });
    }
    this.logger.log(`Mobile hub: ${this.byEmail.size} motorista(s) em memória.`);
  }

  async validar(email: string, password: string) {
    const m = this.byEmail.get(email.toLowerCase());
    if (!m) return null;
    const ok = await bcrypt.compare(password, m.passwordHash);
    return ok ? m : null;
  }

  obterPorId(id: string) {
    return [...this.byEmail.values()].find((x) => x.id === id);
  }
}
