import { BadRequestException, Inject, Injectable, Logger, NotFoundException, forwardRef } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { resolveStoreTenantId } from '../common/stores/store-tenant.util';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import {
  MSG_MOTORISTA_INDISPONIVEL_PORTAL,
  diasRestantesSuspensao,
  isCpfFrotaPlaceholder,
  motoristaEstaSuspenso,
  normalizeMotoristaCpf,
  parseInicioYmd,
  SUSPENSAO_INDEFINIDA_ATE,
  suspensaoEhIndefinida,
  suspensoAteEm,
} from './catalogo-motoristas-externos.util';

export type CatalogoMotoristaExternoDto = {
  id: string;
  cpf: string;
  nome: string;
  origem: string;
  suspenso: boolean;
  indefinido: boolean;
  suspensoEm: string | null;
  suspensoAte: string | null;
  suspensaoDias: number | null;
  diasRestantes: number | null;
  suspensaoMotivo: string | null;
  atualizadoEm: string;
};

type RowMotorista = {
  id: string;
  cpf: string;
  nome: string;
  origem: string;
  suspensoAte: Date | null;
  suspensaoDias: number | null;
  suspensaoMotivo: string | null;
  suspensoEm: Date | null;
  updatedAt: Date;
};

@Injectable()
export class CatalogoMotoristasExternosService {
  private readonly logger = new Logger(CatalogoMotoristasExternosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
    @Inject(forwardRef(() => AuthService)) private readonly auth: AuthService,
  ) {}

  private async exigirGerente(documento: string, password: string) {
    const tenantId = resolveStoreTenantId(this.tenantCtx);
    return this.auth.verifyGerenteCredentials(tenantId, documento, password);
  }

  /** Libera CPFs cujo prazo já venceu (Brasília). */
  async liberarExpirados(): Promise<number> {
    const now = new Date();
    const out = await this.prisma.catalogoMotoristaExterno.updateMany({
      where: { suspensoAte: { lte: now } },
      data: {
        suspensoAte: null,
        suspensaoDias: null,
        suspensaoMotivo: null,
        suspensoEm: null,
        suspensoPorUserId: null,
      },
    });
    return out.count;
  }

  async buscarPorCpf(cpfRaw: string): Promise<CatalogoMotoristaExternoDto | null> {
    await this.liberarExpirados();
    const cpf = normalizeMotoristaCpf(cpfRaw);
    if (cpf.length !== 11 || isCpfFrotaPlaceholder(cpf)) return null;
    const row = await this.prisma.catalogoMotoristaExterno.findFirst({ where: { cpf } });
    return row ? this.toDto(row) : null;
  }

  /** Portal: sem motivo nem prazo — evita texto com risco jurídico. */
  async buscarPorCpfPortal(cpfRaw: string): Promise<CatalogoMotoristaExternoDto | null> {
    const hit = await this.buscarPorCpf(cpfRaw);
    if (!hit?.suspenso) return hit;
    return {
      ...hit,
      suspensaoMotivo: null,
      suspensoAte: null,
      suspensaoDias: null,
      diasRestantes: null,
      suspensoEm: null,
      indefinido: false,
    };
  }

  async listar(query: { search?: string; status?: string; page?: number }) {
    await this.liberarExpirados();
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = 10;
    const and: object[] = [];
    const search = query.search?.trim();
    if (search) {
      const digits = search.replace(/\D/g, '');
      const or: object[] = [{ nome: { contains: search, mode: 'insensitive' } }];
      if (digits.length >= 3) or.push({ cpf: { contains: digits } });
      and.push({ OR: or });
    }
    const now = new Date();
    if (query.status === 'suspensos') {
      and.push({ suspensoAte: { gt: now } });
    } else if (query.status === 'livres') {
      and.push({ OR: [{ suspensoAte: null }, { suspensoAte: { lte: now } }] });
    }
    const where = and.length ? { AND: and } : {};

    const [rows, total] = await Promise.all([
      this.prisma.catalogoMotoristaExterno.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.catalogoMotoristaExterno.count({ where }),
    ]);
    return { items: rows.map((r) => this.toDto(r)), total, page, pageSize };
  }

  async assertNaoSuspenso(cpfRaw: string): Promise<void> {
    await this.liberarExpirados();
    const hit = await this.buscarPorCpf(cpfRaw);
    if (!hit?.suspenso) return;
    throw new BadRequestException(MSG_MOTORISTA_INDISPONIVEL_PORTAL);
  }

  async registrarDaSolicitacao(input: { cpf: string; nome: string; origem?: string }): Promise<void> {
    const cpf = normalizeMotoristaCpf(input.cpf);
    const nome = input.nome.trim();
    if (cpf.length !== 11 || isCpfFrotaPlaceholder(cpf) || !nome) return;
    const tenantId = resolveStoreTenantId(this.tenantCtx);
    try {
      await this.prisma.catalogoMotoristaExterno.upsert({
        where: { tenantId_cpf: { tenantId, cpf } },
        create: { tenantId, cpf, nome, origem: input.origem || 'PORTAL' },
        update: { nome, origem: input.origem || undefined },
      });
    } catch (err) {
      this.logger.warn(`Catálogo de motorista ${cpf} não gravou: ${(err as Error).message}`);
    }
  }

  async suspender(
    id: string,
    input: {
      dias?: number;
      indefinido?: boolean;
      inicio?: string;
      motivo: string;
      documento: string;
      password: string;
    },
  ) {
    const gerente = await this.exigirGerente(input.documento, input.password);
    const row = await this.prisma.catalogoMotoristaExterno.findFirst({ where: { id } });
    if (!row) throw new NotFoundException('Motorista externo não encontrado neste terminal.');
    const texto = input.motivo.trim();
    if (texto.length < 3) {
      throw new BadRequestException('Informe o motivo da suspensão.');
    }
    const inicio = parseInicioYmd(input.inicio);
    const indefinido = Boolean(input.indefinido);
    let dias: number | null = null;
    let ate: Date;
    if (indefinido) {
      ate = SUSPENSAO_INDEFINIDA_ATE;
    } else {
      const d = Number(input.dias);
      if (!Number.isFinite(d) || d < 1 || d > 365) {
        throw new BadRequestException('Informe a suspensão em dias (1 a 365).');
      }
      dias = Math.round(d);
      ate = suspensoAteEm(dias, inicio);
      if (ate.getTime() <= Date.now()) {
        throw new BadRequestException('O prazo do bloqueio já teria encerrado. Ajuste a data de início ou os dias.');
      }
    }
    const updated = await this.prisma.catalogoMotoristaExterno.update({
      where: { id: row.id },
      data: {
        suspensaoDias: dias,
        suspensaoMotivo: texto.slice(0, 500),
        suspensoAte: ate,
        suspensoEm: inicio,
        suspensoPorUserId: gerente.id,
      },
    });
    return this.toDto(updated);
  }

  async liberar(id: string, input: { documento: string; password: string }) {
    await this.exigirGerente(input.documento, input.password);
    const row = await this.prisma.catalogoMotoristaExterno.findFirst({ where: { id } });
    if (!row) throw new NotFoundException('Motorista externo não encontrado neste terminal.');
    const updated = await this.prisma.catalogoMotoristaExterno.update({
      where: { id: row.id },
      data: {
        suspensoAte: null,
        suspensaoDias: null,
        suspensaoMotivo: null,
        suspensoEm: null,
        suspensoPorUserId: null,
      },
    });
    return this.toDto(updated);
  }

  private toDto(row: RowMotorista): CatalogoMotoristaExternoDto {
    const indefinido = suspensaoEhIndefinida(row.suspensoAte, row.suspensaoDias);
    return {
      id: row.id,
      cpf: row.cpf,
      nome: row.nome,
      origem: row.origem,
      suspenso: motoristaEstaSuspenso(row.suspensoAte),
      indefinido,
      suspensoEm: row.suspensoEm?.toISOString() ?? null,
      suspensoAte: row.suspensoAte?.toISOString() ?? null,
      suspensaoDias: row.suspensaoDias,
      diasRestantes: indefinido ? null : diasRestantesSuspensao(row.suspensoAte),
      suspensaoMotivo: row.suspensaoMotivo,
      atualizadoEm: row.updatedAt.toISOString(),
    };
  }
}
