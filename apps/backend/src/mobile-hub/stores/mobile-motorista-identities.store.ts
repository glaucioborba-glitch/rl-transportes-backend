import { randomUUID } from 'crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { normalizeLoginDocumento } from '../../common/utils/login-documento.util';
import { PrismaService } from '../../prisma/prisma.service';

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

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const raw = process.env.MOBILE_MOTORISTA_SEED?.trim();
    if (!raw) return;
    for (const line of raw.split(/[\n;]+/).map((s) => s.trim()).filter(Boolean)) {
      const [documentoRaw, password, protocolo] = line.split('|').map((s) => s.trim());
      if (!documentoRaw || !password) continue;
      const cpfCnpj = normalizeLoginDocumento(documentoRaw);
      const hash = await bcrypt.hash(password, 10);
      const email = `motorista-${cpfCnpj}@mobile.local`;
      await this.prisma.mobileMotoristaIdentity.upsert({
        where: { cpfCnpj },
        create: {
          cpfCnpj,
          email,
          passwordHash: hash,
          protocoloPadrao: protocolo || 'PROT-DEFAULT',
        },
        update: {
          passwordHash: hash,
          protocoloPadrao: protocolo || 'PROT-DEFAULT',
        },
      });
    }
    const count = await this.prisma.mobileMotoristaIdentity.count();
    this.logger.log(`Mobile hub: ${count} motorista(s) persistidos.`);
  }

  async validar(documentoRaw: string, password: string) {
    const cpfCnpj = normalizeLoginDocumento(documentoRaw);
    const m = await this.prisma.mobileMotoristaIdentity.findUnique({ where: { cpfCnpj } });
    if (!m) return null;
    const ok = await bcrypt.compare(password, m.passwordHash);
    if (!ok) return null;
    return {
      id: m.id,
      email: m.email,
      cpfCnpj: m.cpfCnpj,
      passwordHash: m.passwordHash,
      protocoloPadrao: m.protocoloPadrao,
      tokenVersion: m.tokenVersion,
    } satisfies MotoristaIdentity;
  }

  async obterPorId(id: string) {
    const m = await this.prisma.mobileMotoristaIdentity.findUnique({ where: { id } });
    if (!m) return undefined;
    return {
      id: m.id,
      email: m.email,
      cpfCnpj: m.cpfCnpj,
      passwordHash: m.passwordHash,
      protocoloPadrao: m.protocoloPadrao,
      tokenVersion: m.tokenVersion,
    } satisfies MotoristaIdentity;
  }
}
