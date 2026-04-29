import { randomUUID } from 'crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { PortalPapel } from '../types/cx-portal.types';

export type FornecedorPortalIdentity = {
  id: string;
  email: string;
  passwordHash: string;
  tenantId: string;
  papel: PortalPapel;
  tokenVersion: number;
};

/** Identidades B2B supply (memória; seed via CX_PORTAL_FORNECEDOR_SEED). */
@Injectable()
export class PortalFornecedorIdentitiesStore implements OnModuleInit {
  private readonly logger = new Logger(PortalFornecedorIdentitiesStore.name);
  private readonly mapByEmail = new Map<string, FornecedorPortalIdentity>();

  async onModuleInit() {
    const raw = process.env.CX_PORTAL_FORNECEDOR_SEED?.trim();
    if (!raw) return;
    const lines = raw.split(/[\n;]+/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const parts = line.split('|').map((p) => p.trim());
      if (parts.length < 3) continue;
      const [email, password, tenantId, papelRaw] = parts;
      const papel = (papelRaw === 'PARCEIRO' ? 'PARCEIRO' : 'FORNECEDOR') as PortalPapel;
      await this.registrarInicial(email, password, tenantId, papel);
    }
    this.logger.log(`CX: ${this.mapByEmail.size} identidade(s) fornecedor/parceiro em memória.`);
  }

  private async registrarInicial(email: string, password: string, tenantId: string, papel: PortalPapel) {
    const norm = email.toLowerCase();
    const hash = await bcrypt.hash(password, 10);
    const id = randomUUID();
    this.mapByEmail.set(norm, {
      id,
      email: norm,
      passwordHash: hash,
      tenantId: tenantId || 'default',
      papel,
      tokenVersion: 0,
    });
  }

  async validarSenha(email: string, password: string): Promise<FornecedorPortalIdentity | null> {
    const u = this.mapByEmail.get(email.toLowerCase());
    if (!u) return null;
    const ok = await bcrypt.compare(password, u.passwordHash);
    return ok ? u : null;
  }

  obterPorEmail(email: string): FornecedorPortalIdentity | undefined {
    return this.mapByEmail.get(email.toLowerCase());
  }

  obterPorId(id: string): FornecedorPortalIdentity | undefined {
    return [...this.mapByEmail.values()].find((x) => x.id === id);
  }

  bumpTokenVersion(id: string) {
    const u = [...this.mapByEmail.values()].find((x) => x.id === id);
    if (u) u.tokenVersion += 1;
  }

  getTokenVersion(id: string): number {
    return this.obterPorId(id)?.tokenVersion ?? 0;
  }
}
