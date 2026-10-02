import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantStatus } from '@prisma/client';
import type { Request, Response } from 'express';
import { attachSaTenantCookies, clearSaTenantCookies } from '../auth/auth-cookie.util';
import { FEATURE_FLAG_KEYS } from '../feature-flags/feature-flag.keys';
import { PrismaService } from '../prisma/prisma.service';
import { validarCNPJ } from '../common/utils/br-documents';
import { readSaActingTenantCookie } from '../tenant/sa-acting-tenant.util';
import { DEFAULT_TENANT_PARAMETROS } from '../tenant/tenant-config.types';
import {
  applyEmpresaIdentidade,
  cnpjFromParametros,
  digitsCnpj,
  motivoBloqueioExclusao,
  podeAlterarStatusBase,
  TENANT_BASE_ID,
  type EmpresaIdentidadePatch,
  type TenantUso,
} from './super-admin.util';
import { parseIdiomaPadrao, parseMoedaCorrente } from '../tenant/tenant-locale.util';

const FLAG_CATALOGO: Array<{ chave: string; descricao: string }> = [
  {
    chave: FEATURE_FLAG_KEYS.FISCAL_INTEGRATION_ENABLED,
    descricao: 'Emissão NFS-e e boleto (IPM). Sem isso a fatura grava, mas não sai guia.',
  },
  {
    chave: FEATURE_FLAG_KEYS.GATE_AUTO_APPROVE_ENABLED,
    descricao: 'Aprovação automática no gate (só use em ambiente controlado).',
  },
];

@Injectable()
export class SuperAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listTenants() {
    const rows = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        config: { select: { tenantKey: true, nome: true, parametros: true } },
        _count: {
          select: {
            users: true,
            clientes: true,
            solicitacoes: true,
            faturas: true,
            unidadeProcessos: true,
          },
        },
      },
    });
    return rows.map((t) => {
      const uso: TenantUso = {
        users: t._count.users,
        clientes: t._count.clientes,
        solicitacoes: t._count.solicitacoes,
        faturas: t._count.faturas,
        unidadeProcessos: t._count.unidadeProcessos,
      };
      const bloqueioExclusao = motivoBloqueioExclusao(t.id, uso);
      return {
        id: t.id,
        slug: t.slug,
        nome: t.nome,
        status: t.status,
        plano: t.plano,
        moedaCorrente: parseMoedaCorrente(t.moedaCorrente),
        idiomaPadrao: parseIdiomaPadrao(t.idiomaPadrao),
        cnpj: cnpjFromParametros(t.config?.parametros),
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        config: t.config ? { tenantKey: t.config.tenantKey, nome: t.config.nome } : null,
        uso,
        ehBase: t.id === TENANT_BASE_ID,
        podeExcluir: !bloqueioExclusao,
        bloqueioExclusao,
      };
    });
  }

  async createTenant(dto: {
    slug: string;
    nome: string;
    plano?: string;
    cnpj?: string;
    empresa?: EmpresaIdentidadePatch;
    moedaCorrente?: string;
    idiomaPadrao?: string;
  }) {
    const id = dto.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!id) throw new BadRequestException('Slug inválido');
    this.assertCnpj(dto.cnpj);
    const existing = await this.prisma.tenant.findUnique({ where: { id } });
    if (existing) throw new BadRequestException('Tenant já existe');
    const nome = dto.nome.trim();
    const parametros = applyEmpresaIdentidade(DEFAULT_TENANT_PARAMETROS as object, {
      cnpj: dto.cnpj,
      nomeFallback: nome,
      empresa: dto.empresa,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.create({
        data: {
          id,
          slug: id,
          nome,
          plano: dto.plano?.trim() || 'STANDARD',
          moedaCorrente: parseMoedaCorrente(dto.moedaCorrente),
          idiomaPadrao: parseIdiomaPadrao(dto.idiomaPadrao),
        },
      });
      await tx.tenantConfig.create({
        data: {
          tenantId: id,
          tenantKey: id,
          nome,
          parametros: parametros as object,
          slasMinutosMeta: { gate: 240, patio: 4320, saida: 1440 },
          horarioFuncionamento: '06:00–22:00',
          regrasOperacao: 'Configuração inicial SaaS',
        },
      });
    });
    const list = await this.listTenants();
    return list.find((t) => t.id === id)!;
  }

  async updateTenant(
    id: string,
    dto: {
      status?: TenantStatus;
      plano?: string;
      nome?: string;
      cnpj?: string;
      empresa?: EmpresaIdentidadePatch;
      moedaCorrente?: string;
      idiomaPadrao?: string;
    },
  ) {
    const row = await this.prisma.tenant.findUnique({
      where: { id },
      include: { config: true },
    });
    if (!row) throw new NotFoundException('Terminal não encontrado.');
    if (!podeAlterarStatusBase(id, dto.status)) {
      throw new BadRequestException('O terminal base não pode ser bloqueado nem suspenso.');
    }
    this.assertCnpj(dto.cnpj);
    const nome = dto.nome?.trim();
    const parametros = applyEmpresaIdentidade(row.config?.parametros, {
      cnpj: dto.cnpj,
      nomeFallback: nome || row.nome,
      empresa: dto.empresa,
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id },
        data: {
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.plano !== undefined ? { plano: dto.plano } : {}),
          ...(nome ? { nome } : {}),
          ...(dto.moedaCorrente !== undefined
            ? { moedaCorrente: parseMoedaCorrente(dto.moedaCorrente) }
            : {}),
          ...(dto.idiomaPadrao !== undefined
            ? { idiomaPadrao: parseIdiomaPadrao(dto.idiomaPadrao) }
            : {}),
        },
      });
      if (row.config) {
        await tx.tenantConfig.update({
          where: { id: row.config.id },
          data: {
            ...(nome ? { nome } : {}),
            parametros: parametros as object,
          },
        });
      }
    });
    const list = await this.listTenants();
    const updated = list.find((t) => t.id === id);
    if (!updated) throw new NotFoundException('Terminal não encontrado.');
    return updated;
  }

  async deleteTenant(id: string) {
    const row = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            clientes: true,
            solicitacoes: true,
            faturas: true,
            unidadeProcessos: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Terminal não encontrado.');
    const bloqueio = motivoBloqueioExclusao(id, row._count);
    if (bloqueio) throw new ConflictException(bloqueio);
    try {
      await this.prisma.tenant.delete({ where: { id } });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'P2003' || code === 'P2014') {
        throw new ConflictException(
          'Há cadastros ou operação neste terminal. Bloqueie em vez de excluir.',
        );
      }
      throw err;
    }
    return { ok: true, id };
  }

  listFlags() {
    return this.prisma.featureFlag.findMany({ orderBy: { chave: 'asc' } });
  }

  async patchFlag(chave: string, dto: { ativo?: boolean; regras?: Record<string, unknown> }) {
    return this.prisma.featureFlag.update({
      where: { chave },
      data: {
        ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
        ...(dto.regras !== undefined ? { regras: dto.regras as object } : {}),
      },
    });
  }

  async ensureKnownFlags() {
    for (const flag of FLAG_CATALOGO) {
      await this.prisma.featureFlag.upsert({
        where: { chave: flag.chave },
        create: { chave: flag.chave, ativo: false, regras: {}, descricao: flag.descricao },
        update: { descricao: flag.descricao },
      });
    }
    return this.listFlags();
  }

  async entrarIntranet(tenantId: string, res: Response) {
    const row = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!row) throw new NotFoundException('Terminal não encontrado.');
    attachSaTenantCookies(res, row.id, row.nome);
    return {
      ok: true as const,
      tenantId: row.id,
      nome: row.nome,
      slug: row.slug,
      status: row.status,
    };
  }

  sairIntranet(res: Response) {
    clearSaTenantCookies(res);
    return { ok: true as const };
  }

  async intranetSessao(req: Request) {
    const tenantId = readSaActingTenantCookie(req.cookies);
    if (!tenantId) {
      return { acting: false as const, tenantId: null, nome: null, slug: null, status: null };
    }
    const row = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!row) {
      return { acting: false as const, tenantId: null, nome: null, slug: null, status: null };
    }
    return {
      acting: true as const,
      tenantId: row.id,
      nome: row.nome,
      slug: row.slug,
      status: row.status,
    };
  }

  private assertCnpj(raw?: string) {
    if (raw === undefined) return;
    const d = digitsCnpj(raw);
    if (!d) return;
    if (d.length !== 14 || !validarCNPJ(d)) {
      throw new BadRequestException('CNPJ inválido.');
    }
  }
}
