import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AcaoAuditoria, Prisma } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { validateCnpjDigits } from '../common/utils/br-documents';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import { CadastrosTransportadoraFormDto } from './dto/cadastros-transportadora-form.dto';
import { CadastrosTransportadoraQueryDto } from './dto/cadastros-transportadora-query.dto';

const PAGE_SIZE = 10;

const AUDIT_FIELD_LABELS: Record<string, string> = {
  razaoSocial: 'Razão Social',
  nomeFantasia: 'Nome Fantasia',
  cnpj: 'CNPJ',
  rntrc: 'RNTRC',
  rntrcValidade: 'Validade RNTRC',
  ie: 'Inscrição Estadual',
  email: 'E-mail',
  telefone: 'Telefone',
  cidade: 'Cidade',
  uf: 'UF',
  ativo: 'Status',
  deletedAt: 'Status cadastro',
};

type TransportadoraRow = Prisma.CadastroTransportadoraGetPayload<{
  include: { _count: { select: { motoristas: true } } };
}>;

@Injectable()
export class CadastrosTransportadorasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async list(query: CadastrosTransportadoraQueryDto, _actor: AuthUser) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.limit && query.limit > 0 ? query.limit : PAGE_SIZE;
    const status = query.status ?? 'ativas';
    const skip = (page - 1) * pageSize;

    const where: Prisma.CadastroTransportadoraWhereInput = {};

    if (status === 'ativas') {
      where.deletedAt = null;
      where.ativo = true;
    } else if (status === 'inativas') {
      where.OR = [{ deletedAt: { not: null } }, { ativo: false }];
    }

    const search = query.search?.trim();
    if (search) {
      const digits = search.replace(/\D/g, '');
      const orClause: Prisma.CadastroTransportadoraWhereInput[] = [
        { razaoSocial: { contains: search, mode: 'insensitive' } },
        { nomeFantasia: { contains: search, mode: 'insensitive' } },
        { cidade: { contains: search, mode: 'insensitive' } },
      ];
      if (digits.length >= 3) {
        orClause.push({ cnpj: { contains: digits } });
        if (digits.length <= 8) orClause.push({ rntrc: { contains: digits } });
      }
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        { OR: orClause },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.cadastroTransportadora.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { razaoSocial: 'asc' },
        include: {
          _count: {
            select: {
              motoristas: { where: { deletedAt: null, ativo: true } },
            },
          },
        },
      }),
      this.prisma.cadastroTransportadora.count({ where }),
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

  async validateRntrc(rntrc: string) {
    const clean = rntrc.replace(/\D/g, '');
    if (clean.length !== 8) {
      return { valido: false, message: 'RNTRC deve ter 8 dígitos.' };
    }

    const existing = await this.prisma.cadastroTransportadora.findFirst({
      where: { rntrc: clean, deletedAt: null },
      select: { razaoSocial: true, rntrcValidade: true },
    });

    if (existing) {
      return {
        valido: true,
        razaoSocial: existing.razaoSocial,
        validade: existing.rntrcValidade?.toISOString().slice(0, 10) ?? null,
        fonte: 'cadastro_local',
      };
    }

    return {
      valido: true,
      razaoSocial: null,
      validade: null,
      fonte: 'formato',
      aviso: 'Validação ANTT online indisponível. Confirme manualmente.',
    };
  }

  async create(
    dto: CadastrosTransportadoraFormDto,
    usuarioId: string,
    ip: string,
    userAgent: string,
  ) {
    this.assertCnpjValido(dto.cnpj);
    const cnpj = dto.cnpj.replace(/\D/g, '');
    const dup = await this.prisma.cadastroTransportadora.findFirst({
      where: { cnpj, deletedAt: null },
      select: { id: true, razaoSocial: true },
    });
    if (dup) {
      throw new ConflictException(`CNPJ já cadastrado: ${dup.razaoSocial}.`);
    }

    const data = this.buildPrismaData(dto, cnpj);

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.cadastroTransportadora.create({ data });
      await this.auditoriaService.registrar(
        {
          tabela: 'cadastros_transportadoras',
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
    dto: CadastrosTransportadoraFormDto,
    usuarioId: string,
    ip: string,
    userAgent: string,
  ) {
    this.assertCnpjValido(dto.cnpj);
    const antes = await this.getRowOrThrow(id);
    const cnpj = dto.cnpj.replace(/\D/g, '');
    if (cnpj !== antes.cnpj) {
      const dup = await this.prisma.cadastroTransportadora.findFirst({
        where: { cnpj, deletedAt: null, NOT: { id } },
        select: { razaoSocial: true },
      });
      if (dup) {
        throw new ConflictException(`CNPJ já cadastrado: ${dup.razaoSocial}.`);
      }
    }

    const data = this.buildPrismaUpdateData(dto, cnpj);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.cadastroTransportadora.update({ where: { id }, data });
      await this.auditoriaService.registrar(
        {
          tabela: 'cadastros_transportadoras',
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
      await tx.cadastroTransportadora.update({
        where: { id },
        data: { ativo: false, deletedAt: new Date() },
      });
      await this.auditoriaService.registrar(
        {
          tabela: 'cadastros_transportadoras',
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
    const rows = await this.auditoriaService.buscarPorRegistro('cadastros_transportadoras', id);
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

  private async getRowOrThrow(id: string) {
    const row = await this.prisma.cadastroTransportadora.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            motoristas: { where: { deletedAt: null, ativo: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Transportadora não encontrada.');
    return row;
  }

  private assertCnpjValido(cnpj: string) {
    const clean = cnpj.replace(/\D/g, '');
    if (!validateCnpjDigits(clean)) {
      throw new BadRequestException('CNPJ inválido — dígitos verificadores não conferem.');
    }
  }

  private buildDadosJson(dto: CadastrosTransportadoraFormDto): Prisma.InputJsonValue {
    return {
      celular: dto.celular ?? '',
      cep: dto.cep ?? '',
      endereco: dto.endereco ?? '',
      numero: dto.numero ?? '',
      complemento: dto.complemento ?? '',
      bairro: dto.bairro ?? '',
      frotaTotal: dto.frotaTotal ?? 0,
      tiposVeiculo: dto.tiposVeiculo ?? [],
      rotasAutorizadas: dto.rotasAutorizadas ?? [],
      condicaoPagamento: dto.condicaoPagamento ?? '',
      observacoes: dto.observacoes ?? '',
    };
  }

  private buildPrismaData(
    dto: CadastrosTransportadoraFormDto,
    cnpj: string,
  ): Prisma.CadastroTransportadoraCreateInput {
    const ativo = dto.ativo ?? true;
    return {
      razaoSocial: dto.razaoSocial.trim(),
      nomeFantasia: dto.nomeFantasia?.trim() || null,
      cnpj,
      rntrc: dto.rntrc?.replace(/\D/g, '') || null,
      rntrcValidade: dto.rntrcValidade ? new Date(dto.rntrcValidade) : null,
      ie: dto.ie?.trim() || null,
      email: dto.email?.trim() || null,
      telefone: dto.telefone?.replace(/\D/g, '') || null,
      cidade: dto.cidade?.trim() || null,
      uf: dto.uf?.trim().toUpperCase() || null,
      ativo,
      dados: this.buildDadosJson(dto),
      deletedAt: ativo ? null : new Date(),
    };
  }

  private buildPrismaUpdateData(
    dto: CadastrosTransportadoraFormDto,
    cnpj: string,
  ): Prisma.CadastroTransportadoraUpdateInput {
    const ativo = dto.ativo ?? true;
    return {
      razaoSocial: dto.razaoSocial.trim(),
      nomeFantasia: dto.nomeFantasia?.trim() || null,
      cnpj,
      rntrc: dto.rntrc?.replace(/\D/g, '') || null,
      rntrcValidade: dto.rntrcValidade ? new Date(dto.rntrcValidade) : null,
      ie: dto.ie?.trim() || null,
      email: dto.email?.trim() || null,
      telefone: dto.telefone?.replace(/\D/g, '') || null,
      cidade: dto.cidade?.trim() || null,
      uf: dto.uf?.trim().toUpperCase() || null,
      ativo,
      dados: this.buildDadosJson(dto),
      deletedAt: ativo ? null : new Date(),
    };
  }

  private toListItem(row: TransportadoraRow) {
    const dados = (row.dados ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      razaoSocial: row.razaoSocial,
      nomeFantasia: row.nomeFantasia,
      cnpj: row.cnpj,
      rntrc: row.rntrc,
      rntrcValidade: row.rntrcValidade?.toISOString().slice(0, 10) ?? null,
      cidade: row.cidade,
      uf: row.uf,
      telefone: row.telefone,
      ativo: row.ativo && !row.deletedAt,
      motoristasAtivos: row._count.motoristas,
      frotaTotal: (dados.frotaTotal as number) ?? 0,
      solicitacoesMes: 0,
    };
  }

  private toFormShape(row: TransportadoraRow) {
    const dados = (row.dados ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      razaoSocial: row.razaoSocial,
      nomeFantasia: row.nomeFantasia ?? '',
      cnpj: row.cnpj,
      rntrc: row.rntrc ?? '',
      rntrcValidade: row.rntrcValidade?.toISOString().slice(0, 10) ?? '',
      ie: row.ie ?? '',
      email: row.email ?? '',
      telefone: row.telefone ?? '',
      celular: (dados.celular as string) ?? '',
      cep: (dados.cep as string) ?? '',
      endereco: (dados.endereco as string) ?? '',
      numero: (dados.numero as string) ?? '',
      complemento: (dados.complemento as string) ?? '',
      bairro: (dados.bairro as string) ?? '',
      cidade: row.cidade ?? '',
      uf: row.uf ?? '',
      frotaTotal: (dados.frotaTotal as number) ?? 0,
      tiposVeiculo: (dados.tiposVeiculo as string[]) ?? [],
      rotasAutorizadas: (dados.rotasAutorizadas as string[]) ?? [],
      condicaoPagamento: (dados.condicaoPagamento as string) ?? '',
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
