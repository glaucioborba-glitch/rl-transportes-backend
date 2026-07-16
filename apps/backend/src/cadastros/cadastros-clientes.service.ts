import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AcaoAuditoria,
  Prisma,
  TipoCliente,
} from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { validateCnpjDigits } from '../common/utils/br-documents';
import { AddressService } from '../common/address/address.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ClientesService } from '../clientes/clientes.service';
import { CreateClienteDto } from '../clientes/dto/create-cliente.dto';
import { UpdateClienteDto } from '../clientes/dto/update-cliente.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CadastrosClienteFormDto } from './dto/cadastros-cliente-form.dto';
import { CadastrosClienteQueryDto } from './dto/cadastros-cliente-query.dto';

const PAGE_SIZE = 10;

const AUDIT_FIELD_LABELS: Record<string, string> = {
  razaoSocial: 'Razão Social',
  nomeFantasia: 'Nome Fantasia',
  cpfCnpj: 'CNPJ',
  inscricaoEstadual: 'IE',
  inscricaoMunicipal: 'IM',
  email: 'E-mail',
  telefone: 'Telefone',
  enderecoLogradouro: 'Endereço',
  enderecoNumero: 'Número',
  enderecoComplemento: 'Complemento',
  enderecoBairro: 'Bairro',
  enderecoCidade: 'Cidade',
  enderecoUf: 'UF',
  enderecoCep: 'CEP',
  condicaoPagamento: 'Condição de Pagamento',
  deletedAt: 'Status',
};

@Injectable()
export class CadastrosClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientesService: ClientesService,
    private readonly auditoriaService: AuditoriaService,
    private readonly address: AddressService,
  ) {}

  async list(query: CadastrosClienteQueryDto, actor: AuthUser) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const status = query.status ?? 'ativos';
    const skip = (page - 1) * PAGE_SIZE;

    const where: Prisma.ClienteWhereInput = {};
    if (status === 'ativos') where.deletedAt = null;
    if (status === 'inativos') where.deletedAt = { not: null };

    const search = query.search?.trim();
    if (search) {
      const digits = search.replace(/\D/g, '');
      const orClause: Prisma.ClienteWhereInput[] = [
        { razaoSocial: { contains: search, mode: 'insensitive' } },
        { nomeFantasia: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
      if (digits.length >= 3) orClause.push({ cpfCnpj: { contains: digits } });
      where.OR = orClause;
    }

    const [rows, total] = await Promise.all([
      this.prisma.cliente.findMany({
        where,
        skip,
        take: PAGE_SIZE,
        orderBy: { razaoSocial: 'asc' },
        select: {
          id: true,
          razaoSocial: true,
          nomeFantasia: true,
          cpfCnpj: true,
          inscricaoEstadual: true,
          telefone: true,
          enderecoCidade: true,
          enderecoUf: true,
          deletedAt: true,
          _count: {
            select: {
              solicitacoes: { where: { deletedAt: null } },
            },
          },
        },
      }),
      this.prisma.cliente.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        razaoSocial: r.razaoSocial,
        nomeFantasia: r.nomeFantasia,
        cnpj: r.cpfCnpj,
        ie: r.inscricaoEstadual,
        telefone: r.telefone,
        cidade: r.enderecoCidade,
        uf: r.enderecoUf,
        ativo: r.deletedAt == null,
        contratosAtivos: 0,
        solicitacoes: r._count.solicitacoes,
      })),
      total,
      page,
      pageSize: PAGE_SIZE,
    };
  }

  async findOne(id: string, actor: AuthUser) {
    const cliente = await this.clientesService.findOne(id, actor);
    return this.toFormShape(cliente as Record<string, unknown>);
  }

  async create(
    dto: CadastrosClienteFormDto,
    usuarioId: string,
    ip: string,
    userAgent: string,
  ) {
    const createDto = await this.toCreateDto(dto);
    const created = await this.clientesService.create(createDto, usuarioId, ip, userAgent);
    return this.toFormShape(created as Record<string, unknown>);
  }

  async update(
    id: string,
    dto: CadastrosClienteFormDto,
    usuarioId: string,
    ip: string,
    userAgent: string,
    actor: AuthUser,
  ) {
    const updateDto = await this.toUpdateDto(dto);
    const updated = await this.clientesService.update(
      id,
      updateDto,
      usuarioId,
      ip,
      userAgent,
      actor,
    );
    return this.toFormShape(updated as Record<string, unknown>);
  }

  async inativar(id: string, usuarioId: string, ip: string, userAgent: string) {
    return this.clientesService.remove(id, usuarioId, ip, userAgent);
  }

  async listAuditoria(id: string) {
    const rows = await this.auditoriaService.buscarPorRegistro('clientes', id);
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

  async validateCnpj(cnpj: string) {
    const clean = cnpj.replace(/\D/g, '');
    if (!validateCnpjDigits(clean)) {
      throw new BadRequestException('CNPJ inválido — dígitos verificadores não conferem.');
    }

    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        return { valido: true, razaoSocial: null };
      }
      const body = (await res.json()) as Record<string, unknown>;
      return {
        valido: true,
        razaoSocial: typeof body.razao_social === 'string' ? body.razao_social : null,
        nomeFantasia:
          typeof body.nome_fantasia === 'string' && body.nome_fantasia
            ? body.nome_fantasia
            : typeof body.razao_social === 'string'
              ? body.razao_social
              : null,
        cep: typeof body.cep === 'string' ? body.cep.replace(/\D/g, '') : null,
        endereco: typeof body.logradouro === 'string' ? body.logradouro : null,
        numero: typeof body.numero === 'string' ? body.numero : null,
        bairro: typeof body.bairro === 'string' ? body.bairro : null,
        cidade: typeof body.municipio === 'string' ? body.municipio : null,
        uf: typeof body.uf === 'string' ? body.uf : null,
        email: typeof body.email === 'string' ? body.email : null,
        telefone: null,
      };
    } catch {
      return { valido: true, razaoSocial: null };
    }
  }

  async lookupCep(cep: string) {
    const r = await this.address.lookupCepAutofill(cep.replace(/\D/g, ''));
    return {
      logradouro: r.logradouro ?? '',
      bairro: r.bairro ?? '',
      localidade: r.cidade ?? '',
      uf: r.uf ?? '',
      complemento: '',
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
    const skip = new Set(['id', 'tenantId', 'createdAt', 'updatedAt']);
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
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }

  private toFormShape(cliente: Record<string, unknown>) {
    return {
      id: cliente.id,
      razaoSocial: cliente.razaoSocial ?? '',
      nomeFantasia: cliente.nomeFantasia ?? '',
      cnpj: cliente.cpfCnpj ?? '',
      ie: cliente.inscricaoEstadual ?? '',
      im: cliente.inscricaoMunicipal ?? '',
      email: cliente.email ?? '',
      telefone: cliente.telefone ?? '',
      celular: cliente.responsavelTelefone ?? '',
      cep: cliente.enderecoCep ?? '',
      endereco: cliente.enderecoLogradouro ?? '',
      numero: cliente.enderecoNumero ?? '',
      complemento: cliente.enderecoComplemento ?? '',
      bairro: cliente.enderecoBairro ?? '',
      cidade: cliente.enderecoCidade ?? '',
      uf: cliente.enderecoUf ?? '',
      observacoes: '',
      condicaoPagamento: cliente.condicaoPagamento ?? '',
      limiteCredito: '',
      segmento: '',
      tipoCliente: cliente.tipo ?? 'PJ',
      ativo: cliente.deletedAt == null,
    };
  }

  private async toCreateDto(dto: CadastrosClienteFormDto): Promise<CreateClienteDto> {
    const telefone = dto.telefone || dto.celular;
    if (!telefone) {
      throw new BadRequestException('Telefone ou celular é obrigatório.');
    }
    if (!dto.email) throw new BadRequestException('E-mail é obrigatório.');
    if (!dto.endereco || !dto.bairro || !dto.cidade || !dto.uf || !dto.cep) {
      throw new BadRequestException('Endereço completo é obrigatório.');
    }

    const createDto: CreateClienteDto = {
      tipo: TipoCliente.PJ,
      razaoSocial: dto.razaoSocial,
      nomeFantasia: dto.nomeFantasia?.trim() || dto.razaoSocial,
      cpfCnpj: dto.cnpj,
      inscricaoEstadual: dto.ie,
      inscricaoMunicipal: dto.im,
      email: dto.email,
      emailNfse: dto.email,
      telefone,
      enderecoCep: dto.cep,
      enderecoLogradouro: dto.endereco,
      enderecoNumero: dto.numero?.trim() || 'S/N',
      enderecoComplemento: dto.complemento,
      enderecoBairro: dto.bairro,
      enderecoCidade: dto.cidade,
      enderecoUf: dto.uf,
      responsavel: dto.razaoSocial,
      responsavelTelefone: dto.celular || telefone,
      responsavelEmail: dto.email,
    };

    return createDto;
  }

  private async toUpdateDto(dto: CadastrosClienteFormDto): Promise<UpdateClienteDto> {
    const telefone = dto.telefone || dto.celular;
    const update: UpdateClienteDto = {
      razaoSocial: dto.razaoSocial,
      nomeFantasia: dto.nomeFantasia?.trim() || dto.razaoSocial,
      inscricaoEstadual: dto.ie,
      inscricaoMunicipal: dto.im,
      email: dto.email,
      emailNfse: dto.email,
      telefone,
      enderecoCep: dto.cep,
      enderecoLogradouro: dto.endereco,
      enderecoNumero: dto.numero?.trim() || 'S/N',
      enderecoComplemento: dto.complemento,
      enderecoBairro: dto.bairro,
      enderecoCidade: dto.cidade,
      enderecoUf: dto.uf,
      responsavel: dto.razaoSocial,
      responsavelTelefone: dto.celular || telefone,
      responsavelEmail: dto.email,
    };
    return update;
  }
}
