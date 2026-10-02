import { randomUUID } from 'crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { PortalPapel } from '../types/cx-portal.types';
import { normalizeLoginDocumento } from '../../common/utils/login-documento.util';
import { ConfigCacheService } from '../../common/cache/config-cache.service';
import { PrismaService } from '../../prisma/prisma.service';

export type FornecedorPortalIdentity = {
  id: string;
  email: string;
  cpfCnpj: string;
  passwordHash: string;
  tenantId: string;
  papel: PortalPapel;
  tokenVersion: number;
};

/** Identidades B2B supply — PostgreSQL (fonte da verdade) + cache Redis. */
@Injectable()
export class PortalFornecedorIdentitiesStore implements OnModuleInit {
  private readonly logger = new Logger(PortalFornecedorIdentitiesStore.name);
  private readonly prefix = 'cx:forn';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: ConfigCacheService,
  ) {}

  async onModuleInit() {
    const raw = process.env.CX_PORTAL_FORNECEDOR_SEED?.trim();
    if (!raw) return;
    const lines = raw.split(/[\n;]+/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const parts = line.split('|').map((p) => p.trim());
      if (parts.length < 3) continue;
      const [documento, password, tenantId, papelRaw] = parts;
      const papel = (papelRaw === 'PARCEIRO' ? 'PARCEIRO' : 'FORNECEDOR') as PortalPapel;
      await this.registrarInicial(documento, password, tenantId, papel);
    }
    const count = await this.prisma.cxPortalFornecedorIdentity.count();
    this.logger.log(`CX: ${count} identidade(s) fornecedor/parceiro persistidas.`);
  }

  private mapRow(row: {
    id: string;
    email: string;
    cpfCnpj: string;
    passwordHash: string;
    tenantId: string;
    papel: string;
    tokenVersion: number;
  }): FornecedorPortalIdentity {
    return {
      id: row.id,
      email: row.email,
      cpfCnpj: row.cpfCnpj,
      passwordHash: row.passwordHash,
      tenantId: row.tenantId,
      papel: row.papel as PortalPapel,
      tokenVersion: row.tokenVersion,
    };
  }

  private async registrarInicial(
    documentoRaw: string,
    password: string,
    tenantId: string,
    papel: PortalPapel,
  ) {
    const cpfCnpj = normalizeLoginDocumento(documentoRaw);
    const hash = await bcrypt.hash(password, 10);
    const email = `cx-seed-${cpfCnpj}@fornecedor.local`;
    await this.prisma.cxPortalFornecedorIdentity.upsert({
      where: { cpfCnpj },
      create: {
        id: randomUUID(),
        cpfCnpj,
        email,
        passwordHash: hash,
        tenantId: tenantId || 'default',
        papel,
      },
      update: {
        passwordHash: hash,
        tenantId: tenantId || 'default',
        papel,
      },
    });
    await this.cache.invalidate(this.cache.key(this.prefix, cpfCnpj));
  }

  async validarSenha(
    documentoRaw: string,
    password: string,
  ): Promise<FornecedorPortalIdentity | null> {
    const cpfCnpj = normalizeLoginDocumento(documentoRaw);
    const u = await this.obterPorDocumento(cpfCnpj);
    if (!u) return null;
    const ok = await bcrypt.compare(password, u.passwordHash);
    return ok ? u : null;
  }

  async obterPorDocumento(cpfCnpj: string): Promise<FornecedorPortalIdentity | null> {
    const doc = normalizeLoginDocumento(cpfCnpj);
    const ck = this.cache.key(this.prefix, doc);
    const cached = await this.cache.get<FornecedorPortalIdentity>(ck);
    if (cached) return cached;
    const row = await this.prisma.cxPortalFornecedorIdentity.findUnique({ where: { cpfCnpj: doc } });
    if (!row) return null;
    const mapped = this.mapRow(row);
    await this.cache.set(ck, mapped);
    return mapped;
  }

  async obterPorId(id: string): Promise<FornecedorPortalIdentity | null> {
    const ck = this.cache.key(`${this.prefix}:id`, id);
    const cached = await this.cache.get<FornecedorPortalIdentity>(ck);
    if (cached) return cached;
    const row = await this.prisma.cxPortalFornecedorIdentity.findUnique({ where: { id } });
    if (!row) return null;
    const mapped = this.mapRow(row);
    await this.cache.set(ck, mapped);
    await this.cache.set(this.cache.key(this.prefix, row.cpfCnpj), mapped);
    return mapped;
  }

  async bumpTokenVersion(id: string) {
    const row = await this.prisma.cxPortalFornecedorIdentity.update({
      where: { id },
      data: { tokenVersion: { increment: 1 } },
    });
    await this.cache.invalidate(this.cache.key(this.prefix, row.cpfCnpj));
    await this.cache.invalidate(this.cache.key(`${this.prefix}:id`, id));
  }

  async getTokenVersion(id: string): Promise<number> {
    return (await this.obterPorId(id))?.tokenVersion ?? 0;
  }
}
