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
import { CadastrosColaboradorFormDto } from './dto/cadastros-colaborador-form.dto';
import { CadastrosColaboradorQueryDto } from './dto/cadastros-colaborador-query.dto';
import {
  ColaboradorFamiliarFormDto,
  CreateFamiliarDto,
  UpdateFamiliarDto,
} from './dto/colaborador-familiar.dto';

const PAGE_SIZE = 10;
const MAX_FAMILIARES = 10;

const CENTROS_CUSTO: Record<string, string> = {
  'CC-OP': 'Operacional',
  'CC-GATE': 'Gate CPO',
  'CC-PATIO': 'Pátio',
  'CC-ADM': 'Administrativo',
  'CC-FIN': 'Financeiro',
  'CC-RH': 'Recursos Humanos',
  'CC-SSMA': 'SSMA',
  'CC-TI': 'Tecnologia da Informação',
};

const AUDIT_FIELD_LABELS: Record<string, string> = {
  nome: 'Nome',
  cpf: 'CPF',
  matricula: 'Matrícula',
  cargo: 'Cargo',
  departamento: 'Departamento',
  vinculo: 'Vínculo',
  status: 'Status',
  dataAdmissao: 'Data de Admissão',
  gestorId: 'Gestor',
  centroCustoCodigo: 'Centro de Custo',
  deletedAt: 'Status cadastro',
};

type ColaboradorListRow = Prisma.CadastroColaboradorGetPayload<{
  include: { gestor: { select: { id: true; nome: true } } };
}>;

type ColaboradorRow = Prisma.CadastroColaboradorGetPayload<{
  include: {
    gestor: { select: { id: true; nome: true } };
    familiares: true;
  };
}>;

@Injectable()
export class CadastrosColaboradoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async list(query: CadastrosColaboradorQueryDto, _actor: AuthUser) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const status = query.status ?? 'ativos';
    const skip = (page - 1) * PAGE_SIZE;

    const where: Prisma.CadastroColaboradorWhereInput = {};

    if (status === 'ativos') {
      where.deletedAt = null;
      where.status = { in: ['ATIVO', 'FERIAS'] };
    } else if (status === 'afastados') {
      where.deletedAt = null;
      where.status = 'AFASTADO';
    } else if (status === 'inativos') {
      where.OR = [{ deletedAt: { not: null } }, { status: 'INATIVO' }];
    }

    const vinculo = query.vinculo?.trim();
    if (vinculo && vinculo !== 'todos') {
      where.vinculo = vinculo;
    }

    const search = query.search?.trim();
    if (search) {
      const digits = search.replace(/\D/g, '');
      const orClause: Prisma.CadastroColaboradorWhereInput[] = [
        { nome: { contains: search, mode: 'insensitive' } },
        { cargo: { contains: search, mode: 'insensitive' } },
        { matricula: { contains: search, mode: 'insensitive' } },
      ];
      if (digits.length >= 3) orClause.push({ cpf: { contains: digits } });
      where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), { OR: orClause }];
    }

    const [rows, total] = await Promise.all([
      this.prisma.cadastroColaborador.findMany({
        where,
        skip,
        take: PAGE_SIZE,
        orderBy: { nome: 'asc' },
        include: {
          gestor: { select: { id: true, nome: true } },
        },
      }),
      this.prisma.cadastroColaborador.count({ where }),
    ]);

    return {
      items: rows.map((r) => this.toListItem(r)),
      total,
      page,
      pageSize: PAGE_SIZE,
    };
  }

  async findOne(id: string) {
    const row = await this.getRowOrThrow(id);
    return this.toFormShape(row);
  }

  async checkCpf(cpf: string, excludeId?: string) {
    const clean = cpf.replace(/\D/g, '');
    const existing = await this.prisma.cadastroColaborador.findFirst({
      where: { cpf: clean, deletedAt: null },
      select: { id: true, nome: true, matricula: true },
    });
    if (!existing || existing.id === excludeId) {
      return { exists: false };
    }
    return {
      exists: true,
      id: existing.id,
      nome: existing.nome,
      matricula: existing.matricula,
    };
  }

  async create(
    dto: CadastrosColaboradorFormDto,
    usuarioId: string,
    ip: string,
    userAgent: string,
  ) {
    this.assertCpfValido(dto.cpf);
    const cpf = dto.cpf.replace(/\D/g, '');
    const dup = await this.checkCpf(cpf);
    if (dup.exists) {
      throw new ConflictException(
        `CPF já cadastrado: ${dup.nome} (matrícula ${dup.matricula ?? '—'}).`,
      );
    }

    const { centroCustoCodigo, centroCustoNome } = this.parseCentroCusto(dto.centroCustoId);
    const matricula = dto.matricula?.trim() || (await this.nextMatricula());

    const data = this.buildPrismaData(dto, {
      cpf,
      matricula,
      centroCustoCodigo,
      centroCustoNome,
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.cadastroColaborador.create({ data });
      await this.auditoriaService.registrar(
        {
          tabela: 'cadastros_colaboradores',
          registroId: row.id,
          acao: AcaoAuditoria.INSERT,
          usuario: usuarioId,
          dadosDepois: row,
          ip,
          userAgent,
        },
        tx,
      );
      if (dto.familiares?.length) {
        await this.createFamiliaresBatch(tx, row.id, row.tenantId, dto.familiares);
      }
      return row;
    });

    return this.toFormShape(await this.getRowOrThrow(created.id));
  }

  async update(
    id: string,
    dto: CadastrosColaboradorFormDto,
    usuarioId: string,
    ip: string,
    userAgent: string,
  ) {
    this.assertCpfValido(dto.cpf);
    const antes = await this.getRowOrThrow(id);
    const cpf = dto.cpf.replace(/\D/g, '');
    if (cpf !== antes.cpf) {
      const dup = await this.checkCpf(cpf, id);
      if (dup.exists) {
        throw new ConflictException(`CPF já cadastrado: ${dup.nome}.`);
      }
    }

    const { centroCustoCodigo, centroCustoNome } = this.parseCentroCusto(dto.centroCustoId);
    const data = this.buildPrismaUpdateData(dto, {
      cpf,
      matricula: dto.matricula?.trim() || antes.matricula,
      centroCustoCodigo,
      centroCustoNome,
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.cadastroColaborador.update({ where: { id }, data });
      await this.auditoriaService.registrar(
        {
          tabela: 'cadastros_colaboradores',
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
      if (dto.familiares !== undefined) {
        await this.syncFamiliares(tx, id, row.tenantId, dto.familiares);
      }
      return row;
    });

    return this.toFormShape(await this.getRowOrThrow(updated.id));
  }

  async inativar(id: string, usuarioId: string, ip: string, userAgent: string) {
    const antes = await this.getRowOrThrow(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.cadastroColaborador.update({
        where: { id },
        data: { status: 'INATIVO', deletedAt: new Date() },
      });
      await this.auditoriaService.registrar(
        {
          tabela: 'cadastros_colaboradores',
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
    const rows = await this.auditoriaService.buscarPorRegistro('cadastros_colaboradores', id);
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

  async listGestores() {
    const rows = await this.prisma.cadastroColaborador.findMany({
      where: { deletedAt: null, status: { in: ['ATIVO', 'FERIAS'] } },
      select: { id: true, nome: true, cargo: true },
      orderBy: { nome: 'asc' },
      take: 200,
    });
    return rows;
  }

  async listCentrosCusto() {
    const rows = await this.prisma.cadastroCentroCusto.findMany({
      where: { deletedAt: null, ativo: true, tipo: 'ANALITICO' },
      orderBy: { codigo: 'asc' },
      select: { codigo: true, nome: true },
    });
    if (rows.length > 0) return rows;
    return Object.entries(CENTROS_CUSTO).map(([codigo, nome]) => ({ codigo, nome }));
  }

  async listFamiliares(colaboradorId: string) {
    await this.getRowOrThrow(colaboradorId);
    return this.prisma.colaboradorFamiliar.findMany({
      where: { colaboradorId, ativo: true },
      orderBy: { nome: 'asc' },
    });
  }

  async addFamiliar(colaboradorId: string, dto: CreateFamiliarDto) {
    const colaborador = await this.getRowOrThrow(colaboradorId);
    this.assertFamiliarCpfValido(dto.cpf);
    const count = await this.prisma.colaboradorFamiliar.count({
      where: { colaboradorId, ativo: true },
    });
    if (count >= MAX_FAMILIARES) {
      throw new BadRequestException('Máximo de 10 familiares por colaborador');
    }
    return this.prisma.colaboradorFamiliar.create({
      data: this.buildFamiliarCreateData(colaboradorId, colaborador.tenantId, dto),
    });
  }

  async updateFamiliar(familiarId: string, dto: UpdateFamiliarDto) {
    const existing = await this.prisma.colaboradorFamiliar.findUnique({
      where: { id: familiarId },
    });
    if (!existing || !existing.ativo) {
      throw new NotFoundException('Familiar não encontrado.');
    }
    if (dto.cpf !== undefined) this.assertFamiliarCpfValido(dto.cpf);
    return this.prisma.colaboradorFamiliar.update({
      where: { id: familiarId },
      data: this.buildFamiliarUpdateData(dto),
    });
  }

  async removeFamiliar(familiarId: string) {
    const existing = await this.prisma.colaboradorFamiliar.findUnique({
      where: { id: familiarId },
    });
    if (!existing || !existing.ativo) {
      throw new NotFoundException('Familiar não encontrado.');
    }
    return this.prisma.colaboradorFamiliar.update({
      where: { id: familiarId },
      data: { ativo: false },
    });
  }

  async deleteFamiliar(familiarId: string) {
    const existing = await this.prisma.colaboradorFamiliar.findUnique({
      where: { id: familiarId },
    });
    if (!existing) {
      throw new NotFoundException('Familiar não encontrado.');
    }
    await this.prisma.colaboradorFamiliar.delete({ where: { id: familiarId } });
  }

  private async getRowOrThrow(id: string): Promise<ColaboradorRow> {
    const row = await this.prisma.cadastroColaborador.findUnique({
      where: { id },
      include: {
        gestor: { select: { id: true, nome: true } },
        familiares: {
          where: { ativo: true },
          orderBy: { nome: 'asc' },
        },
      },
    });
    if (!row) throw new NotFoundException('Colaborador não encontrado.');
    return row;
  }

  private async nextMatricula(): Promise<string> {
    const count = await this.prisma.cadastroColaborador.count();
    return String(count + 1).padStart(4, '0');
  }

  private assertCpfValido(cpf: string) {
    const clean = cpf.replace(/\D/g, '');
    if (!validateCpfDigits(clean)) {
      throw new BadRequestException('CPF inválido — dígitos verificadores não conferem.');
    }
  }

  private parseCentroCusto(centroCustoId?: string) {
    if (!centroCustoId?.trim()) {
      return { centroCustoCodigo: null, centroCustoNome: null };
    }
    const raw = centroCustoId.trim();
    if (raw.includes('|')) {
      const [codigo, nome] = raw.split('|');
      return { centroCustoCodigo: codigo, centroCustoNome: nome };
    }
    return {
      centroCustoCodigo: raw,
      centroCustoNome: CENTROS_CUSTO[raw] ?? raw,
    };
  }

  private buildPrismaUpdateData(
    dto: CadastrosColaboradorFormDto,
    extra: {
      cpf: string;
      matricula: string | null;
      centroCustoCodigo: string | null;
      centroCustoNome: string | null;
    },
  ): Prisma.CadastroColaboradorUpdateInput {
    const status = dto.status ?? 'ATIVO';
    const deletedAt = status === 'INATIVO' ? new Date() : null;

    return {
      nome: dto.nome.trim(),
      cpf: extra.cpf,
      matricula: extra.matricula,
      cargo: dto.cargo?.trim() || null,
      departamento: dto.departamento?.trim() || null,
      vinculo: dto.vinculo ?? 'CLT',
      status,
      dataAdmissao: new Date(dto.dataAdmissao),
      gestor: dto.gestorId
        ? { connect: { id: dto.gestorId } }
        : { disconnect: true },
      centroCustoCodigo: extra.centroCustoCodigo,
      centroCustoNome: extra.centroCustoNome,
      dados: this.dtoToDadosJson(dto),
      deletedAt,
    };
  }

  private buildPrismaData(
    dto: CadastrosColaboradorFormDto,
    extra: {
      cpf: string;
      matricula: string | null;
      centroCustoCodigo: string | null;
      centroCustoNome: string | null;
    },
  ): Prisma.CadastroColaboradorCreateInput {
    const status = dto.status ?? 'ATIVO';
    const deletedAt = status === 'INATIVO' ? new Date() : null;

    return {
      nome: dto.nome.trim(),
      cpf: extra.cpf,
      matricula: extra.matricula,
      cargo: dto.cargo?.trim() || null,
      departamento: dto.departamento?.trim() || null,
      vinculo: dto.vinculo ?? 'CLT',
      status,
      dataAdmissao: new Date(dto.dataAdmissao),
      gestor: dto.gestorId
        ? { connect: { id: dto.gestorId } }
        : undefined,
      centroCustoCodigo: extra.centroCustoCodigo,
      centroCustoNome: extra.centroCustoNome,
      dados: this.dtoToDadosJson(dto),
      deletedAt,
    };
  }

  private dtoToDadosJson(dto: CadastrosColaboradorFormDto): Prisma.InputJsonValue {
    const { familiares: _familiares, ...rest } = dto;
    return rest as unknown as Prisma.InputJsonValue;
  }

  private normalizeFamiliaresInput(
    familiares: ColaboradorFamiliarFormDto[],
  ): ColaboradorFamiliarFormDto[] {
    return familiares
      .map((f) => ({
        ...f,
        nome: f.nome?.trim() ?? '',
        cpf: f.cpf?.replace(/\D/g, '') || undefined,
      }))
      .filter((f) => f.nome.length >= 3);
  }

  private assertFamiliaresLimit(count: number) {
    if (count > MAX_FAMILIARES) {
      throw new BadRequestException('Máximo de 10 familiares por colaborador');
    }
  }

  private assertFamiliarCpfValido(cpf?: string) {
    if (!cpf?.trim()) return;
    const clean = cpf.replace(/\D/g, '');
    if (clean.length !== 11 || !validateCpfDigits(clean)) {
      throw new BadRequestException('CPF do familiar inválido — dígitos verificadores não conferem.');
    }
  }

  private buildFamiliarCreateData(
    colaboradorId: string,
    tenantId: string,
    dto: CreateFamiliarDto,
  ): Prisma.ColaboradorFamiliarCreateInput {
    this.assertFamiliarCpfValido(dto.cpf);
    return {
      colaborador: { connect: { id: colaboradorId } },
      tenantId,
      nome: dto.nome.trim(),
      cpf: dto.cpf?.replace(/\D/g, '') || null,
      dataAniversario: dto.dataAniversario ? new Date(dto.dataAniversario) : null,
      parentesco: dto.parentesco?.trim() || null,
    };
  }

  private buildFamiliarUpdateData(dto: UpdateFamiliarDto): Prisma.ColaboradorFamiliarUpdateInput {
    const data: Prisma.ColaboradorFamiliarUpdateInput = {};
    if (dto.nome !== undefined) data.nome = dto.nome.trim();
    if (dto.cpf !== undefined) data.cpf = dto.cpf?.replace(/\D/g, '') || null;
    if (dto.dataAniversario !== undefined) {
      data.dataAniversario = dto.dataAniversario ? new Date(dto.dataAniversario) : null;
    }
    if (dto.parentesco !== undefined) data.parentesco = dto.parentesco?.trim() || null;
    return data;
  }

  private async createFamiliaresBatch(
    tx: Prisma.TransactionClient,
    colaboradorId: string,
    tenantId: string,
    familiares: ColaboradorFamiliarFormDto[],
  ) {
    const items = this.normalizeFamiliaresInput(familiares);
    this.assertFamiliaresLimit(items.length);
    for (const f of items) {
      this.assertFamiliarCpfValido(f.cpf);
    }
    if (items.length === 0) return;
    await tx.colaboradorFamiliar.createMany({
      data: items.map((f) => ({
        colaboradorId,
        tenantId,
        nome: f.nome.trim(),
        cpf: f.cpf?.replace(/\D/g, '') || null,
        dataAniversario: f.dataAniversario ? new Date(f.dataAniversario) : null,
        parentesco: f.parentesco?.trim() || null,
      })),
    });
  }

  private async syncFamiliares(
    tx: Prisma.TransactionClient,
    colaboradorId: string,
    tenantId: string,
    familiares: ColaboradorFamiliarFormDto[],
  ) {
    const items = this.normalizeFamiliaresInput(familiares);
    this.assertFamiliaresLimit(items.length);

    const existing = await tx.colaboradorFamiliar.findMany({
      where: { colaboradorId, ativo: true },
    });
    const incomingIds = new Set(items.filter((f) => f.id).map((f) => f.id!));

    for (const row of existing) {
      if (!incomingIds.has(row.id)) {
        await tx.colaboradorFamiliar.update({
          where: { id: row.id },
          data: { ativo: false },
        });
      }
    }

    for (const f of items) {
      this.assertFamiliarCpfValido(f.cpf);
      if (f.id) {
        const match = existing.find((e) => e.id === f.id);
        if (!match) {
          throw new BadRequestException(`Familiar ${f.id} não pertence a este colaborador.`);
        }
        await tx.colaboradorFamiliar.update({
          where: { id: f.id },
          data: this.buildFamiliarUpdateData(f),
        });
      } else {
        await tx.colaboradorFamiliar.create({
          data: {
            colaboradorId,
            tenantId,
            nome: f.nome.trim(),
            cpf: f.cpf?.replace(/\D/g, '') || null,
            dataAniversario: f.dataAniversario ? new Date(f.dataAniversario) : null,
            parentesco: f.parentesco?.trim() || null,
          },
        });
      }
    }
  }

  private mapFamiliares(row: ColaboradorRow) {
    return (row.familiares ?? []).map((f) => ({
      id: f.id,
      nome: f.nome,
      cpf: f.cpf ?? '',
      dataAniversario: f.dataAniversario?.toISOString().slice(0, 10) ?? '',
      parentesco: f.parentesco ?? '',
    }));
  }

  private toListItem(row: ColaboradorListRow) {
    return {
      id: row.id,
      nome: row.nome,
      cargo: row.cargo,
      matricula: row.matricula,
      cpf: row.cpf,
      departamento: row.departamento,
      vinculo: row.vinculo,
      status: row.status,
      dataAdmissao: row.dataAdmissao.toISOString().slice(0, 10),
      centroCusto: row.centroCustoCodigo
        ? { codigo: row.centroCustoCodigo, nome: row.centroCustoNome ?? '' }
        : null,
      gestor: row.gestor ? { id: row.gestor.id, nome: row.gestor.nome } : null,
    };
  }

  private toFormShape(row: ColaboradorRow) {
    const dados = (row.dados ?? {}) as Record<string, unknown>;
    const centroCustoId = row.centroCustoCodigo
      ? row.centroCustoNome
        ? `${row.centroCustoCodigo}|${row.centroCustoNome}`
        : row.centroCustoCodigo
      : '';

    return {
      id: row.id,
      nome: row.nome,
      cpf: row.cpf,
      matricula: row.matricula ?? '',
      cargo: row.cargo ?? '',
      departamento: row.departamento ?? '',
      vinculo: row.vinculo,
      status: row.status,
      dataAdmissao: row.dataAdmissao.toISOString().slice(0, 10),
      gestorId: row.gestorId ?? '',
      centroCustoId,
      gestor: row.gestor ? { id: row.gestor.id, nome: row.gestor.nome } : null,
      centroCusto: row.centroCustoCodigo
        ? { codigo: row.centroCustoCodigo, nome: row.centroCustoNome ?? '' }
        : null,
      ...dados,
      familiares: this.mapFamiliares(row),
      ativo: row.deletedAt == null && row.status !== 'INATIVO',
    };
  }

  private mapAuditAction(acao: AcaoAuditoria): 'CREATE' | 'UPDATE' | 'DELETE' | 'READ' {
    if (acao === AcaoAuditoria.INSERT) return 'CREATE';
    if (acao === AcaoAuditoria.DELETE) return 'DELETE';
    if (acao === AcaoAuditoria.UPDATE) return 'UPDATE';
    return 'READ';
  }

  private buildAuditChanges(
    antes: Record<string, unknown> | null,
    depois: Record<string, unknown> | null,
  ) {
    if (!antes || !depois) return [];
    const skip = new Set(['id', 'tenantId', 'createdAt', 'updatedAt', 'dados']);
    const keys = new Set([...Object.keys(antes), ...Object.keys(depois)]);
    const changes: { field: string; before: string; after: string }[] = [];

    for (const key of keys) {
      if (skip.has(key)) continue;
      const before = this.formatAuditValue(key, antes[key]);
      const after = this.formatAuditValue(key, depois[key]);
      if (before === after) continue;
      changes.push({
        field: AUDIT_FIELD_LABELS[key] ?? key,
        before,
        after,
      });
    }
    return changes;
  }

  private formatAuditValue(key: string, value: unknown): string {
    if (value == null) return '';
    if (key === 'deletedAt') return value ? 'Inativo' : 'Ativo';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value);
  }
}
