import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { resolveStoreTenantId } from '../common/stores/store-tenant.util';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import {
  isCpfFrotaPlaceholder,
  motoristaEstaSuspenso,
  normalizeMotoristaCpf,
  suspensoAteEm,
} from './catalogo-motoristas-externos.util';

export type CatalogoMotoristaExternoDto = {
  id: string;
  cpf: string;
  nome: string;
  origem: string;
  suspenso: boolean;
  suspensoAte: string | null;
  suspensaoDias: number | null;
  suspensaoMotivo: string | null;
  atualizadoEm: string;
};

@Injectable()
export class CatalogoMotoristasExternosService {
  private readonly logger = new Logger(CatalogoMotoristasExternosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  async buscarPorCpf(cpfRaw: string): Promise<CatalogoMotoristaExternoDto | null> {
    const cpf = normalizeMotoristaCpf(cpfRaw);
    if (cpf.length !== 11 || isCpfFrotaPlaceholder(cpf)) return null;
    const row = await this.prisma.catalogoMotoristaExterno.findFirst({ where: { cpf } });
    return row ? this.toDto(row) : null;
  }

  async listar(query: { search?: string; status?: string; page?: number }) {
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
    const hit = await this.buscarPorCpf(cpfRaw);
    if (!hit?.suspenso) return;
    const ate = hit.suspensoAte
      ? new Date(hit.suspensoAte).toLocaleDateString('pt-BR')
      : '—';
    const motivo = hit.suspensaoMotivo ? ` Motivo: ${hit.suspensaoMotivo}` : '';
    throw new BadRequestException(
      `Motorista suspenso neste terminal até ${ate}.${motivo} Não é possível abrir solicitação.`,
    );
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

  async suspender(id: string, dias: number, motivo: string, actorUserId: string) {
    const row = await this.prisma.catalogoMotoristaExterno.findFirst({ where: { id } });
    if (!row) throw new NotFoundException('Motorista externo não encontrado neste terminal.');
    const d = Number(dias);
    if (!Number.isFinite(d) || d < 1 || d > 365) {
      throw new BadRequestException('Informe a suspensão em dias (1 a 365).');
    }
    const texto = motivo.trim();
    if (texto.length < 3) {
      throw new BadRequestException('Informe o motivo da suspensão.');
    }
    const now = new Date();
    const updated = await this.prisma.catalogoMotoristaExterno.update({
      where: { id: row.id },
      data: {
        suspensaoDias: Math.round(d),
        suspensaoMotivo: texto.slice(0, 500),
        suspensoAte: suspensoAteEm(d, now),
        suspensoEm: now,
        suspensoPorUserId: actorUserId,
      },
    });
    return this.toDto(updated);
  }

  async liberar(id: string) {
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

  private toDto(row: {
    id: string;
    cpf: string;
    nome: string;
    origem: string;
    suspensoAte: Date | null;
    suspensaoDias: number | null;
    suspensaoMotivo: string | null;
    updatedAt: Date;
  }): CatalogoMotoristaExternoDto {
    return {
      id: row.id,
      cpf: row.cpf,
      nome: row.nome,
      origem: row.origem,
      suspenso: motoristaEstaSuspenso(row.suspensoAte),
      suspensoAte: row.suspensoAte?.toISOString() ?? null,
      suspensaoDias: row.suspensaoDias,
      suspensaoMotivo: row.suspensaoMotivo,
      atualizadoEm: row.updatedAt.toISOString(),
    };
  }
}
