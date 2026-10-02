import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AcaoAuditoria, Prisma } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import { CadastrosEquipamentoFormDto } from './dto/cadastros-equipamento-form.dto';
import { CadastrosEquipamentoQueryDto } from './dto/cadastros-equipamento-query.dto';

const AUDIT_FIELD_LABELS: Record<string, string> = {
  codigo: 'Código',
  tipo: 'Tipo',
  marca: 'Marca',
  modelo: 'Modelo',
  status: 'Status',
  horimetro: 'Horímetro',
  proximaManutencao: 'Próxima Manutenção',
  ativo: 'Ativo',
  deletedAt: 'Status cadastro',
};

type EquipRow = Prisma.CadastroEquipamentoGetPayload<{
  include: {
    vinculos: {
      where: { ativo: true };
      include: { operador: { select: { id: true; email: true } } };
      take: 1;
    };
  };
}>;

@Injectable()
export class CadastrosEquipamentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async list(query: CadastrosEquipamentoQueryDto, _actor: AuthUser) {
    const status = query.status ?? 'todos';
    const where: Prisma.CadastroEquipamentoWhereInput = {};

    if (status === 'disponiveis') {
      where.deletedAt = null;
      where.ativo = true;
      where.status = 'DISPONIVEL';
    } else if (status === 'em_uso') {
      where.deletedAt = null;
      where.status = 'EM_USO';
    } else if (status === 'manutencao') {
      where.deletedAt = null;
      where.status = 'EM_MANUTENCAO';
    } else if (status === 'inativos') {
      where.OR = [{ deletedAt: { not: null } }, { ativo: false }, { status: 'INATIVO' }];
    } else {
      where.deletedAt = null;
    }

    const search = query.search?.trim();
    if (search) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { codigo: { contains: search, mode: 'insensitive' } },
            { marca: { contains: search, mode: 'insensitive' } },
            { modelo: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const rows = await this.prisma.cadastroEquipamento.findMany({
      where,
      orderBy: { codigo: 'asc' },
      include: {
        vinculos: {
          where: { ativo: true },
          include: { operador: { select: { id: true, email: true } } },
          take: 1,
        },
      },
    });

    return {
      items: rows.map((r) => this.toListItem(r)),
      total: rows.length,
    };
  }

  async findOne(id: string) {
    const row = await this.getRowOrThrow(id);
    return this.toFormShape(row);
  }

  async create(
    dto: CadastrosEquipamentoFormDto,
    usuarioId: string,
    ip: string,
    userAgent: string,
  ) {
    const codigo = dto.codigo.trim().toUpperCase();
    const dup = await this.prisma.cadastroEquipamento.findFirst({
      where: { codigo, deletedAt: null },
    });
    if (dup) throw new ConflictException(`Código já cadastrado: ${codigo}.`);

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.cadastroEquipamento.create({ data: this.buildData(dto, codigo) });
      await this.auditoriaService.registrar(
        {
          tabela: 'cadastros_equipamentos',
          registroId: row.id,
          acao: AcaoAuditoria.INSERT,
          usuario: usuarioId,
          dadosDepois: row,
          ip,
          userAgent,
        },
        tx,
      );
      return row;
    });

    return this.toFormShape(await this.getRowOrThrow(created.id));
  }

  async update(
    id: string,
    dto: CadastrosEquipamentoFormDto,
    usuarioId: string,
    ip: string,
    userAgent: string,
  ) {
    const antes = await this.getRowOrThrow(id);
    const codigo = dto.codigo.trim().toUpperCase();
    if (codigo !== antes.codigo) {
      const dup = await this.prisma.cadastroEquipamento.findFirst({
        where: { codigo, deletedAt: null, NOT: { id } },
      });
      if (dup) throw new ConflictException(`Código já cadastrado: ${codigo}.`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.cadastroEquipamento.update({
        where: { id },
        data: this.buildUpdateData(dto, codigo),
      });
      await this.auditoriaService.registrar(
        {
          tabela: 'cadastros_equipamentos',
          registroId: id,
          acao: AcaoAuditoria.UPDATE,
          usuario: usuarioId,
          dadosAntes: antes,
          dadosDepois: row,
          ip,
          userAgent,
        },
        tx,
      );
      return row;
    });

    return this.toFormShape(await this.getRowOrThrow(updated.id));
  }

  async listAuditoria(id: string) {
    await this.getRowOrThrow(id);
    const rows = await this.auditoriaService.buscarPorRegistro('cadastros_equipamentos', id);
    const userIds = [...new Set(rows.map((r) => r.usuario))];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return rows.map((row) => {
      const u = userMap.get(row.usuario);
      return {
        id: row.id,
        action: row.acao === AcaoAuditoria.INSERT ? 'CREATE' : row.acao === AcaoAuditoria.UPDATE ? 'UPDATE' : row.acao === AcaoAuditoria.DELETE ? 'DELETE' : 'READ',
        createdAt: row.createdAt.toISOString(),
        userName: u?.email ?? row.usuario,
        userEmail: u?.email ?? '',
        changes: this.buildAuditChanges(
          row.dadosAntes as Record<string, unknown> | null,
          row.dadosDepois as Record<string, unknown> | null,
        ),
      };
    });
  }

  private buildData(dto: CadastrosEquipamentoFormDto, codigo: string): Prisma.CadastroEquipamentoCreateInput {
    const ativo = dto.ativo ?? true;
    return {
      codigo,
      tipo: dto.tipo,
      marca: dto.marca?.trim() || null,
      modelo: dto.modelo?.trim() || null,
      capacidade: dto.capacidade?.trim() || null,
      alturaMaxima: dto.alturaMaxima?.trim() || null,
      status: dto.status ?? 'DISPONIVEL',
      horimetro: dto.horimetro ?? 0,
      ultimaManutencao: dto.ultimaManutencao ? new Date(dto.ultimaManutencao) : null,
      proximaManutencao: dto.proximaManutencao ? new Date(dto.proximaManutencao) : null,
      centroCusto: dto.centroCusto?.trim() || null,
      observacoes: dto.observacoes?.trim() || null,
      ativo,
      deletedAt: ativo ? null : new Date(),
    };
  }

  private buildUpdateData(
    dto: CadastrosEquipamentoFormDto,
    codigo: string,
  ): Prisma.CadastroEquipamentoUpdateInput {
    const ativo = dto.ativo ?? true;
    return {
      codigo,
      tipo: dto.tipo,
      marca: dto.marca?.trim() || null,
      modelo: dto.modelo?.trim() || null,
      capacidade: dto.capacidade?.trim() || null,
      alturaMaxima: dto.alturaMaxima?.trim() || null,
      status: dto.status ?? 'DISPONIVEL',
      horimetro: dto.horimetro ?? 0,
      ultimaManutencao: dto.ultimaManutencao ? new Date(dto.ultimaManutencao) : null,
      proximaManutencao: dto.proximaManutencao ? new Date(dto.proximaManutencao) : null,
      centroCusto: dto.centroCusto?.trim() || null,
      observacoes: dto.observacoes?.trim() || null,
      ativo,
      deletedAt: ativo ? null : new Date(),
    };
  }

  private async getRowOrThrow(id: string): Promise<EquipRow> {
    const row = await this.prisma.cadastroEquipamento.findUnique({
      where: { id },
      include: {
        vinculos: {
          where: { ativo: true },
          include: { operador: { select: { id: true, email: true } } },
          take: 1,
        },
      },
    });
    if (!row || row.deletedAt) throw new NotFoundException('Equipamento não encontrado.');
    return row;
  }

  private toListItem(row: EquipRow) {
    const vinculo = row.vinculos[0];
    const operadorEmail = vinculo?.operador?.email ?? '';
    return {
      id: row.id,
      codigo: row.codigo,
      tipo: row.tipo,
      marca: row.marca,
      modelo: row.modelo,
      capacidade: row.capacidade,
      alturaMaxima: row.alturaMaxima,
      status: row.status,
      horimetro: row.horimetro,
      proximaManutencao: row.proximaManutencao?.toISOString().slice(0, 10) ?? null,
      ultimaManutencao: row.ultimaManutencao?.toISOString().slice(0, 10) ?? null,
      ativo: row.ativo,
      operadorAtual: vinculo
        ? { id: vinculo.operador.id, nome: operadorEmail.split('@')[0] || operadorEmail }
        : null,
    };
  }

  private toFormShape(row: EquipRow) {
    return {
      id: row.id,
      codigo: row.codigo,
      tipo: row.tipo,
      marca: row.marca ?? '',
      modelo: row.modelo ?? '',
      capacidade: row.capacidade ?? '',
      alturaMaxima: row.alturaMaxima ?? '',
      status: row.status,
      horimetro: row.horimetro,
      ultimaManutencao: row.ultimaManutencao?.toISOString().slice(0, 10) ?? '',
      proximaManutencao: row.proximaManutencao?.toISOString().slice(0, 10) ?? '',
      centroCusto: row.centroCusto ?? '',
      observacoes: row.observacoes ?? '',
      ativo: row.ativo,
    };
  }

  private buildAuditChanges(
    antes: Record<string, unknown> | null,
    depois: Record<string, unknown> | null,
  ) {
    const keys = new Set([...Object.keys(antes ?? {}), ...Object.keys(depois ?? {})]);
    const changes: { field: string; before: string; after: string }[] = [];
    for (const key of keys) {
      if (['createdAt', 'updatedAt', 'dados', 'tenantId', 'vinculos'].includes(key)) continue;
      const beforeStr = this.fmt(antes?.[key]);
      const afterStr = this.fmt(depois?.[key]);
      if (beforeStr !== afterStr) {
        changes.push({ field: AUDIT_FIELD_LABELS[key] ?? key, before: beforeStr, after: afterStr });
      }
    }
    return changes;
  }

  private fmt(val: unknown): string {
    if (val === null || val === undefined) return '';
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
    return String(val);
  }
}
