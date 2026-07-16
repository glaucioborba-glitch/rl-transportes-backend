import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AcaoAuditoria, Prisma } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { validateCpfDigits } from '../common/utils/br-documents';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import { CadastrosMotoristaFormDto } from './dto/cadastros-motorista-form.dto';
import { CadastrosMotoristaQueryDto } from './dto/cadastros-motorista-query.dto';

const PAGE_SIZE = 10;

const AUDIT_FIELD_LABELS: Record<string, string> = {
  nome: 'Nome',
  cpf: 'CPF',
  transportadoraId: 'Transportadora',
  cnhNumero: 'Número CNH',
  cnhCategoria: 'Categoria CNH',
  cnhValidade: 'Validade CNH',
  cnhUfEmissao: 'UF Emissão CNH',
  celular: 'Celular',
  ativo: 'Status',
  deletedAt: 'Status cadastro',
};

type MotoristaRow = Prisma.CadastroMotoristaGetPayload<{
  include: { transportadora: { select: { id: true; razaoSocial: true; cnpj: true } } };
}>;

@Injectable()
export class CadastrosMotoristasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async list(query: CadastrosMotoristaQueryDto, _actor: AuthUser) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.limit && query.limit > 0 ? query.limit : PAGE_SIZE;
    const status = query.status ?? 'ativos';
    const skip = (page - 1) * pageSize;

    const where: Prisma.CadastroMotoristaWhereInput = {};

    if (status === 'ativos') {
      where.deletedAt = null;
      where.ativo = true;
    } else if (status === 'inativos') {
      where.OR = [{ deletedAt: { not: null } }, { ativo: false }];
    }

    if (query.transportadoraId) {
      where.transportadoraId = query.transportadoraId;
    }

    const search = query.search?.trim();
    if (search) {
      const digits = search.replace(/\D/g, '');
      const orClause: Prisma.CadastroMotoristaWhereInput[] = [
        { nome: { contains: search, mode: 'insensitive' } },
        { transportadora: { razaoSocial: { contains: search, mode: 'insensitive' } } },
      ];
      if (digits.length >= 3) orClause.push({ cpf: { contains: digits } });
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        { OR: orClause },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.cadastroMotorista.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { nome: 'asc' },
        include: {
          transportadora: { select: { id: true, razaoSocial: true, cnpj: true } },
        },
      }),
      this.prisma.cadastroMotorista.count({ where }),
    ]);

    return {
      items: rows.map((r) => this.toListItem(r)),
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: string) {
    const row = await this.getRowOrThrow(id);
    return this.toFormShape(row);
  }

  async checkCpf(cpf: string, excludeId?: string) {
    const clean = cpf.replace(/\D/g, '');
    const existing = await this.prisma.cadastroMotorista.findFirst({
      where: { cpf: clean, deletedAt: null },
      select: { id: true, nome: true },
    });
    if (!existing || existing.id === excludeId) {
      return { exists: false };
    }
    return {
      exists: true,
      id: existing.id,
      nome: existing.nome,
    };
  }

  async create(
    dto: CadastrosMotoristaFormDto,
    usuarioId: string,
    ip: string,
    userAgent: string,
  ) {
    this.assertCpfValido(dto.cpf);
    await this.assertTransportadoraExists(dto.transportadoraId);
    const cpf = dto.cpf.replace(/\D/g, '');
    const dup = await this.checkCpf(cpf);
    if (dup.exists) {
      throw new ConflictException(`CPF já cadastrado: ${dup.nome}.`);
    }

    const data = this.buildPrismaData(dto, cpf);

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.cadastroMotorista.create({ data });
      await this.auditoriaService.registrar(
        {
          tabela: 'cadastros_motoristas',
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
    dto: CadastrosMotoristaFormDto,
    usuarioId: string,
    ip: string,
    userAgent: string,
  ) {
    this.assertCpfValido(dto.cpf);
    await this.assertTransportadoraExists(dto.transportadoraId);
    const antes = await this.getRowOrThrow(id);
    const cpf = dto.cpf.replace(/\D/g, '');
    if (cpf !== antes.cpf) {
      const dup = await this.checkCpf(cpf, id);
      if (dup.exists) {
        throw new ConflictException(`CPF já cadastrado: ${dup.nome}.`);
      }
    }

    const data = this.buildPrismaUpdateData(dto, cpf);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.cadastroMotorista.update({ where: { id }, data });
      await this.auditoriaService.registrar(
        {
          tabela: 'cadastros_motoristas',
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

  async inativar(id: string, usuarioId: string, ip: string, userAgent: string) {
    const antes = await this.getRowOrThrow(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.cadastroMotorista.update({
        where: { id },
        data: { ativo: false, deletedAt: new Date() },
      });
      await this.auditoriaService.registrar(
        {
          tabela: 'cadastros_motoristas',
          registroId: id,
          acao: AcaoAuditoria.DELETE,
          usuario: usuarioId,
          dadosAntes: antes,
          dadosDepois: null,
          ip,
          userAgent,
        },
        tx,
      );
    });
    return { id, removed: true };
  }

  async listAuditoria(id: string) {
    await this.getRowOrThrow(id);
    const rows = await this.auditoriaService.buscarPorRegistro('cadastros_motoristas', id);
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
        action: this.mapAuditAction(row.acao),
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

  private async getRowOrThrow(id: string): Promise<MotoristaRow> {
    const row = await this.prisma.cadastroMotorista.findUnique({
      where: { id },
      include: {
        transportadora: { select: { id: true, razaoSocial: true, cnpj: true } },
      },
    });
    if (!row) throw new NotFoundException('Motorista não encontrado.');
    return row;
  }

  private async assertTransportadoraExists(transportadoraId: string) {
    const t = await this.prisma.cadastroTransportadora.findFirst({
      where: { id: transportadoraId, deletedAt: null, ativo: true },
      select: { id: true },
    });
    if (!t) {
      throw new BadRequestException('Transportadora vinculada não encontrada ou inativa.');
    }
  }

  private assertCpfValido(cpf: string) {
    const clean = cpf.replace(/\D/g, '');
    if (!validateCpfDigits(clean)) {
      throw new BadRequestException('CPF inválido — dígitos verificadores não conferem.');
    }
  }

  private buildDadosJson(dto: CadastrosMotoristaFormDto): Prisma.InputJsonValue {
    return {
      rg: dto.rg ?? '',
      dataNascimento: dto.dataNascimento ?? '',
      telefone: dto.telefone ?? '',
      email: dto.email ?? '',
      cep: dto.cep ?? '',
      endereco: dto.endereco ?? '',
      numero: dto.numero ?? '',
      complemento: dto.complemento ?? '',
      bairro: dto.bairro ?? '',
      cidade: dto.cidade ?? '',
      uf: dto.uf ?? '',
      observacoes: dto.observacoes ?? '',
    };
  }

  private buildPrismaData(
    dto: CadastrosMotoristaFormDto,
    cpf: string,
  ): Prisma.CadastroMotoristaCreateInput {
    const ativo = dto.ativo ?? true;
    return {
      nome: dto.nome.trim(),
      cpf,
      transportadora: { connect: { id: dto.transportadoraId } },
      cnhNumero: dto.cnhNumero.trim(),
      cnhCategoria: dto.cnhCategoria,
      cnhValidade: new Date(dto.cnhValidade),
      cnhUfEmissao: dto.cnhUfEmissao?.trim().toUpperCase() || null,
      celular: dto.celular?.replace(/\D/g, '') || null,
      ativo,
      dados: this.buildDadosJson(dto),
      deletedAt: ativo ? null : new Date(),
    };
  }

  private buildPrismaUpdateData(
    dto: CadastrosMotoristaFormDto,
    cpf: string,
  ): Prisma.CadastroMotoristaUpdateInput {
    const ativo = dto.ativo ?? true;
    return {
      nome: dto.nome.trim(),
      cpf,
      transportadora: { connect: { id: dto.transportadoraId } },
      cnhNumero: dto.cnhNumero.trim(),
      cnhCategoria: dto.cnhCategoria,
      cnhValidade: new Date(dto.cnhValidade),
      cnhUfEmissao: dto.cnhUfEmissao?.trim().toUpperCase() || null,
      celular: dto.celular?.replace(/\D/g, '') || null,
      ativo,
      dados: this.buildDadosJson(dto),
      deletedAt: ativo ? null : new Date(),
    };
  }

  private toListItem(row: MotoristaRow) {
    return {
      id: row.id,
      nome: row.nome,
      cpf: row.cpf,
      celular: row.celular,
      cnhCategoria: row.cnhCategoria,
      cnhValidade: row.cnhValidade?.toISOString().slice(0, 10) ?? null,
      ativo: row.ativo && !row.deletedAt,
      transportadora: row.transportadora
        ? {
            id: row.transportadora.id,
            razaoSocial: row.transportadora.razaoSocial,
            cnpj: row.transportadora.cnpj,
          }
        : null,
      viagensMes: 0,
      ultimaViagem: null,
    };
  }

  private toFormShape(row: MotoristaRow) {
    const dados = (row.dados ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      nome: row.nome,
      cpf: row.cpf,
      rg: (dados.rg as string) ?? '',
      dataNascimento: (dados.dataNascimento as string) ?? '',
      celular: row.celular ?? '',
      telefone: (dados.telefone as string) ?? '',
      email: (dados.email as string) ?? '',
      cep: (dados.cep as string) ?? '',
      endereco: (dados.endereco as string) ?? '',
      numero: (dados.numero as string) ?? '',
      complemento: (dados.complemento as string) ?? '',
      bairro: (dados.bairro as string) ?? '',
      cidade: (dados.cidade as string) ?? '',
      uf: (dados.uf as string) ?? '',
      transportadoraId: row.transportadoraId,
      cnhNumero: row.cnhNumero ?? '',
      cnhCategoria: row.cnhCategoria ?? '',
      cnhValidade: row.cnhValidade?.toISOString().slice(0, 10) ?? '',
      cnhUfEmissao: row.cnhUfEmissao ?? '',
      observacoes: (dados.observacoes as string) ?? '',
      ativo: row.ativo && !row.deletedAt,
    };
  }

  private mapAuditAction(acao: AcaoAuditoria): 'CREATE' | 'UPDATE' | 'DELETE' | 'READ' {
    if (acao === AcaoAuditoria.INSERT) return 'CREATE';
    if (acao === AcaoAuditoria.UPDATE) return 'UPDATE';
    if (acao === AcaoAuditoria.DELETE) return 'DELETE';
    return 'READ';
  }

  private buildAuditChanges(
    antes: Record<string, unknown> | null,
    depois: Record<string, unknown> | null,
  ) {
    const keys = new Set([
      ...Object.keys(antes ?? {}),
      ...Object.keys(depois ?? {}),
    ]);
    const changes: { field: string; before: string; after: string }[] = [];

    for (const key of keys) {
      if (['createdAt', 'updatedAt', 'dados', 'tenantId'].includes(key)) continue;
      const beforeVal = antes?.[key];
      const afterVal = depois?.[key];
      const beforeStr = this.formatAuditValue(beforeVal);
      const afterStr = this.formatAuditValue(afterVal);
      if (beforeStr !== afterStr) {
        changes.push({
          field: AUDIT_FIELD_LABELS[key] ?? key,
          before: beforeStr,
          after: afterStr,
        });
      }
    }
    return changes;
  }

  private formatAuditValue(val: unknown): string {
    if (val === null || val === undefined) return '';
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
    return String(val);
  }
}
