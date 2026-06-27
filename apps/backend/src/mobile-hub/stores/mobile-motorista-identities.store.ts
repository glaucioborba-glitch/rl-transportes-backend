import { randomUUID } from 'crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { normalizeLoginDocumento } from '../../common/utils/login-documento.util';

export type MotoristaIdentity = {
  id: string;
  email: string;
  cpfCnpj: string;
  passwordHash: string;
  protocoloPadrao: string;
  tokenVersion: number;
};

@Injectable()
export class MobileMotoristaIdentitiesStore implements OnModuleInit {
  private readonly logger = new Logger(MobileMotoristaIdentitiesStore.name);
  private readonly byDocumento = new Map<string, MotoristaIdentity>();

  async onModuleInit() {
    const raw = process.env.MOBILE_MOTORISTA_SEED?.trim();
    if (!raw) return;
    for (const line of raw.split(/[\n;]+/).map((s) => s.trim()).filter(Boolean)) {
      const [documentoRaw, password, protocolo] = line.split('|').map((s) => s.trim());
      if (!documentoRaw || !password) continue;
      const cpfCnpj = normalizeLoginDocumento(documentoRaw);
      const hash = await bcrypt.hash(password, 10);
      const id = randomUUID();
      const email = `motorista-${cpfCnpj}@mobile.local`;
      this.byDocumento.set(cpfCnpj, {
        id,
        email,
        cpfCnpj,
        passwordHash: hash,
        protocoloPadrao: protocolo || 'PROT-DEFAULT',
        tokenVersion: 0,
      });
    }
    this.logger.log(`Mobile hub: ${this.byDocumento.size} motorista(s) em memória.`);
  }

  async validar(documentoRaw: string, password: string) {
    const cpfCnpj = normalizeLoginDocumento(documentoRaw);
    const m = this.byDocumento.get(cpfCnpj);
    if (!m) return null;
    const ok = await bcrypt.compare(password, m.passwordHash);
    return ok ? m : null;
  }

  obterPorId(id: string) {
    return [...this.byDocumento.values()].find((x) => x.id === id);
  }
}
