import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { AcaoAuditoria, Prisma, StatusCadastroCliente, TipoCliente, Role } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { PRISMA_SERIALIZABLE_TX } from '../prisma/transaction-options';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { registrarTentativaForaDeEscopo } from '../common/security/scope-audit.util';
import { ClientePaginationDto } from '../common/dtos/pagination.dto';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { assertClienteDocumentoDisponivel } from './cliente-documento.util';
import { clienteCreateInputFromDto, parseDataNascimentoPf } from './cliente-fiscal.mapper';
import { SessionService } from '../auth/session/session.service';
import { AddressService } from '../common/address/address.service';
import {
  applyNormalizedToCreateDto,
  mergePostalForUpdate,
  normalizedToClienteUpdateData,
  postalInputFromCreateDto,
} from '../common/address/cliente-address-bridge';

/** Whitelist de ordenação (alinha ao ClientePaginationDto e evita chaves arbitrárias). */
const CLIENTE_ORDER_BY = new Set(['createdAt', 'razaoSocial', 'email']);

const PF_FORBIDDEN_KEYS: (keyof CreateClienteDto)[] = [
  'nomeFantasia',
  'inscricaoMunicipal',
  'inscricaoEstadual',
  'responsavel',
  'responsavelTelefone',
  'responsavelEmail',
];

const ADDR_UPDATE_KEYS = new Set<keyof UpdateClienteDto>([
  'enderecoCep',
  'enderecoLogradouro',
  'enderecoNumero',
  'enderecoComplemento',
  'enderecoBairro',
  'enderecoCidade',
  'enderecoUf',
  'codigoMunicipioIbge',
]);

/** Campos cadastrais da empresa — exigem `podeGerenciarPessoas` quando o ator é CLIENTE. */
const CADASTRO_EMPRESA_PATCH_KEYS: (keyof UpdateClienteDto)[] = [
  'razaoSocial',
  'nomeCompleto',
  'nomeFantasia',
  'tipo',
  'inscricaoMunicipal',
  'inscricaoEstadual',
  'isentoIE',
  'email',
  'emailNfse',
  'telefone',
  'telefoneContato',
  'enderecoLogradouro',
  'enderecoNumero',
  'enderecoComplemento',
  'enderecoBairro',
  'enderecoCidade',
  'enderecoUf',
  'enderecoCep',
  'codigoMunicipioIbge',
  'responsavel',
  'responsavelTelefone',
  'responsavelEmail',
  'dataNascimento',
];

const PJ_FORBIDDEN_NONEMPTY: (keyof CreateClienteDto)[] = ['nomeCompleto', 'dataNascimento', 'telefoneContato'];

@Injectable()
export class ClientesService {
  private readonly logger = new Logger(ClientesService.name);

  constructor(
    private prisma: PrismaService,
    private auditoria: AuditoriaService,
    private addressService: AddressService,
    private sessionService: SessionService,
  ) {}

  private assertDtoAlinhadoAoTipo(dto: Partial<CreateClienteDto>, tipoEfetivo: TipoCliente) {
    if (tipoEfetivo === TipoCliente.PF) {
      if (dto.razaoSocial !== undefined) {
        throw new BadRequestException(
          'Use "nomeCompleto" para Pessoa Física em vez de "razaoSocial".',
        );
      }
      for (const key of PF_FORBIDDEN_KEYS) {
        const v = dto[key];
        if (v === undefined || v === null) continue;
        if (typeof v === 'string' && v.trim() === '') continue;
        if (key === 'isentoIE' && v === false) continue;
        throw new BadRequestException(
          `Campo "${String(key)}" não é permitido para Pessoa Física.`,
        );
      }
      if (dto.isentoIE === true) {
        throw new BadRequestException('Campo "isentoIE" não é permitido para Pessoa Física.');
      }
      return;
    }

    if (tipoEfetivo === TipoCliente.PJ) {
      for (const key of PJ_FORBIDDEN_NONEMPTY) {
        const v = dto[key];
        if (v === undefined || v === null) continue;
        if (typeof v === 'string' && v.trim() === '') continue;
        throw new BadRequestException(
          `Campo "${String(key)}" não é permitido para Pessoa Jurídica.`,
        );
      }
    }
  }

  private ensurePjNomeFantasia(
    dto: CreateClienteDto | UpdateClienteDto,
    options?: { tipoEfetivo: TipoCliente; nomeFantasiaAtual?: string | null },
  ) {
    const t = options?.tipoEfetivo ?? dto.tipo;
    if (t !== TipoCliente.PJ) return;
    const sent = 'nomeFantasia' in dto && dto.nomeFantasia !== undefined;
    const val = sent
      ? String(dto.nomeFantasia ?? '').trim()
      : (options?.nomeFantasiaAtual ?? '').trim();
    if (!val) {
      throw new BadRequestException('Nome fantasia é obrigatório para pessoa jurídica.');
    }
  }

  private addressFieldsInPatch(dto: UpdateClienteDto): boolean {
    for (const k of ADDR_UPDATE_KEYS) {
      if (dto[k] !== undefined) return true;
    }
    return false;
  }

  private touchesCadastroEmpresa(dto: UpdateClienteDto): boolean {
    return CADASTRO_EMPRESA_PATCH_KEYS.some((k) => dto[k] !== undefined);
  }

  private async assertCanAlterarCadastroEmpresa(actor?: AuthUser): Promise<void> {
    if (!actor || actor.role === Role.ADMIN || actor.role === Role.GERENTE) {
      return;
    }
    if (actor.role !== Role.CLIENTE) {
      return;
    }
    if (!actor.clienteId) {
      throw new ForbiddenException(
        'Usuário de portal sem vínculo a cliente; contate o suporte.',
      );
    }
    if (!actor.sid) {
      throw new ForbiddenException(
        'Selecione sua identidade antes de alterar o cadastro da empresa.',
      );
    }
    const sess = await this.sessionService.getSession(actor.id, actor.sid);
    if (!sess?.permissoesPessoa?.podeGerenciarPessoas) {
      throw new ForbiddenException(
        'Apenas administradores da empresa podem alterar os dados cadastrais.',
      );
    }
  }

  async create(
    createClienteDto: CreateClienteDto,
    usuarioId: string,
    ip: string,
    userAgent: string,
  ) {
    this.assertDtoAlinhadoAoTipo(createClienteDto, createClienteDto.tipo);
    this.ensurePjNomeFantasia(createClienteDto, { tipoEfetivo: createClienteDto.tipo });
    const dtoNorm = { ...createClienteDto };
    const normalizedAddr = await this.addressService.normalize(postalInputFromCreateDto(dtoNorm));
    applyNormalizedToCreateDto(dtoNorm, normalizedAddr);
    const data = clienteCreateInputFromDto(dtoNorm);
    await assertClienteDocumentoDisponivel(this.prisma, data.cpfCnpj, {
      tipo: createClienteDto.tipo,
    });

    try {
      const cliente = await this.prisma.$transaction(async (tx) => {
        const novoCliente = await tx.cliente.create({
          data: {
            ...data,
            statusCadastro: StatusCadastroCliente.APROVADO,
          },
        });

        await this.auditoria.registrar(
          {
            tabela: 'clientes',
            registroId: novoCliente.id,
            acao: AcaoAuditoria.INSERT,
            usuario: usuarioId,
            dadosAntes: null,
            dadosDepois: novoCliente,
            ip,
            userAgent,
          },
          tx,
        );

        return novoCliente;
      }, PRISMA_SERIALIZABLE_TX);

      return this.sanitizeCliente(cliente);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'CPF/CNPJ ou E-mail já cadastrado no sistema',
        );
      }
      throw error;
    }
  }

  async findAllPaginated(query: ClientePaginationDto, actor?: AuthUser) {
    let page = query.page ?? 1;
    let limit = query.limit ?? 10;
    if (page < 1) page = 1;
    if (limit < 1 || limit > 100) limit = 10;

    const skip = (page - 1) * limit;
    const rawOrderBy = query.orderBy ?? 'createdAt';
    const orderBy = CLIENTE_ORDER_BY.has(rawOrderBy) ? rawOrderBy : 'createdAt';
    const order = query.order ?? 'desc';

    const search = query.search?.trim();
    const where: Prisma.ClienteWhereInput = { deletedAt: null };
    if (actor?.role === Role.CLIENTE) {
      if (!actor.clienteId) {
        throw new ForbiddenException(
          'Usuário de portal sem vínculo a cliente; contate o suporte.',
        );
      }
      where.id = actor.clienteId;
    }
    if (search) {
      const digits = search.replace(/\D/g, '');
      const orClause: Prisma.ClienteWhereInput[] = [
        { razaoSocial: { contains: search, mode: 'insensitive' } },
        { nomeFantasia: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
      if (digits.length >= 3) {
        orClause.push({ cpfCnpj: { contains: digits } });
      }
      where.OR = orClause;
    }

    const [clientes, total] = await Promise.all([
      this.prisma.cliente.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderBy]: order },
        select: {
          id: true,
          razaoSocial: true,
          nomeFantasia: true,
          tipo: true,
          email: true,
          telefone: true,
          createdAt: true,
          solicitacoes: {
            where: { deletedAt: null },
            select: {
              id: true,
              protocolo: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.cliente.count({ where }),
    ]);

    return {
      data: clientes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(
    id: string,
    actor?: AuthUser,
    leitura?: { ip?: string; userAgent?: string },
  ) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id, deletedAt: null },
      include: {
        solicitacoes: {
          where: { deletedAt: null },
          include: { unidades: true },
        },
      },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente com ID ${id} não encontrado.`);
    }

    if (actor?.role === Role.CLIENTE) {
      if (!actor.clienteId) {
        throw new ForbiddenException(
          'Usuário de portal sem vínculo a cliente; contate o suporte.',
        );
      }
      if (id !== actor.clienteId) {
        this.logger.warn(
          `Acesso negado: usuário ${actor.id} consultou cadastro de cliente ${id} (vínculo ${actor.clienteId})`,
        );
        await registrarTentativaForaDeEscopo(
          this.auditoria,
          { usuario: actor.id, ip: leitura?.ip, userAgent: leitura?.userAgent },
          {
            recurso: 'cliente',
            tentativaClienteId: id,
            atorClienteId: actor.clienteId,
            registroId: id,
          },
        );
        throw new ForbiddenException('Acesso negado a este cadastro.');
      }
    }

    return cliente;
  }

  async update(
    id: string,
    updateClienteDto: UpdateClienteDto,
    usuarioId: string,
    ip: string,
    userAgent: string,
    actor?: AuthUser,
  ) {
    const clienteAntes = await this.prisma.cliente.findUnique({
      where: { id },
    });

    if (!clienteAntes) {
      throw new NotFoundException(`Cliente com ID ${id} não encontrado.`);
    }

    if (updateClienteDto.cpfCnpj !== undefined) {
      throw new BadRequestException('O CNPJ não pode ser alterado após o cadastro.');
    }

    if (actor?.role === Role.CLIENTE) {
      if (!actor.clienteId || id !== actor.clienteId) {
        throw new ForbiddenException('Acesso negado a este cadastro.');
      }
    }

    if (this.touchesCadastroEmpresa(updateClienteDto)) {
      await this.assertCanAlterarCadastroEmpresa(actor);
    }

    const tipoFinal = updateClienteDto.tipo ?? clienteAntes.tipo;
    this.assertDtoAlinhadoAoTipo(updateClienteDto, tipoFinal);
    this.ensurePjNomeFantasia(updateClienteDto, {
      tipoEfetivo: tipoFinal,
      nomeFantasiaAtual: clienteAntes.nomeFantasia,
    });

    const addrTouched = this.addressFieldsInPatch(updateClienteDto);
    let normalizedPostal = addrTouched
      ? await this.addressService.normalize(mergePostalForUpdate(clienteAntes, updateClienteDto))
      : undefined;

    try {
      const clienteDepois = await this.prisma.$transaction(async (tx) => {
        const dadosAtualizacao: Prisma.ClienteUpdateInput = {};

        if (normalizedPostal) {
          Object.assign(dadosAtualizacao, normalizedToClienteUpdateData(normalizedPostal));
        }

        if (updateClienteDto.nomeCompleto !== undefined && tipoFinal === TipoCliente.PF) {
          dadosAtualizacao.razaoSocial = String(updateClienteDto.nomeCompleto).trim();
        }

        const assign = <K extends keyof UpdateClienteDto>(
          key: K,
          fn?: (v: NonNullable<UpdateClienteDto[K]>) => unknown,
        ) => {
          if (normalizedPostal && ADDR_UPDATE_KEYS.has(key)) return;
          const v = updateClienteDto[key];
          if (v === undefined) return;
          dadosAtualizacao[key as keyof Prisma.ClienteUpdateInput] = (
            fn ? fn(v as NonNullable<typeof v>) : v
          ) as never;
        };

        assign('razaoSocial', (v) => String(v).trim());
        assign('nomeFantasia', (v) => (v == null || String(v).trim() === '' ? null : String(v).trim()));
        assign('tipo');
        assign('inscricaoMunicipal', (v) => String(v).replace(/\D/g, '') || null);
        assign('inscricaoEstadual', (v) => String(v).replace(/\D/g, '') || null);
        assign('isentoIE');
        assign('email', (v) => String(v).trim().toLowerCase());
        assign('emailNfse', (v) => String(v).trim().toLowerCase());
        assign('telefone', (v) => String(v).replace(/\D/g, ''));
        assign('enderecoLogradouro', (v) => String(v).trim());
        assign('enderecoNumero', (v) => String(v).trim());
        assign('enderecoComplemento', (v) =>
          v == null || String(v).trim() === '' ? null : String(v).trim(),
        );
        assign('enderecoBairro', (v) => String(v).trim());
        assign('enderecoCidade', (v) => String(v).trim());
        assign('enderecoUf', (v) => String(v).trim().toUpperCase());
        assign('enderecoCep', (v) => String(v).replace(/\D/g, ''));
        assign('codigoMunicipioIbge', (v) => String(v).replace(/\D/g, ''));
        assign('responsavel', (v) => String(v).trim());
        assign('responsavelTelefone', (v) => String(v).replace(/\D/g, ''));
        assign('responsavelEmail', (v) => String(v).trim().toLowerCase());
        assign('diasToleranciaBloqueio', (v) =>
          v == null || v === ('' as unknown) ? null : Number(v),
        );
        assign('percentualMultaAtraso', (v) =>
          v == null || v === ('' as unknown) ? null : Number(v),
        );
        assign('percentualJurosAoMes', (v) =>
          v == null || v === ('' as unknown) ? null : Number(v),
        );

        if (updateClienteDto.tabelaPrecoId !== undefined) {
          dadosAtualizacao.tabelaPreco = updateClienteDto.tabelaPrecoId
            ? { connect: { id: updateClienteDto.tabelaPrecoId } }
            : { disconnect: true };
        }

        if (updateClienteDto.dataNascimento !== undefined) {
          if (tipoFinal === TipoCliente.PF) {
            const raw = String(updateClienteDto.dataNascimento).trim();
            dadosAtualizacao.dataNascimento = raw
              ? parseDataNascimentoPf(raw)
              : null;
          } else {
            dadosAtualizacao.dataNascimento = null;
          }
        }

        if (tipoFinal === TipoCliente.PF) {
          const em =
            (dadosAtualizacao.email as string | undefined) ?? clienteAntes.email;
          const emLower = em.trim().toLowerCase();
          const emailNfseSent = updateClienteDto.emailNfse;
          const emailNfseNext =
            emailNfseSent !== undefined
              ? String(emailNfseSent).trim().toLowerCase()
              : ((dadosAtualizacao.emailNfse as string | undefined) ?? emLower);

          const telPrincipal =
            updateClienteDto.telefone !== undefined
              ? String(updateClienteDto.telefone).replace(/\D/g, '')
              : clienteAntes.telefone.replace(/\D/g, '');
          const telContato =
            updateClienteDto.telefoneContato !== undefined
              ? String(updateClienteDto.telefoneContato).replace(/\D/g, '')
              : telPrincipal;

          Object.assign(dadosAtualizacao, {
            nomeFantasia: null,
            inscricaoMunicipal: null,
            inscricaoEstadual: null,
            isentoIE: false,
            regimeTributario: null,
            descricaoAtividade: null,
            cnae: null,
            responsavel: null,
            responsavelTelefone: null,
            responsavelEmail: null,
            emailNfse: emailNfseNext,
            telefone: telContato,
          });
        }

        const updated = await tx.cliente.update({
          where: { id },
          data: dadosAtualizacao,
        });

        await this.auditoria.registrar(
          {
            tabela: 'clientes',
            registroId: id,
            acao: AcaoAuditoria.UPDATE,
            usuario: usuarioId,
            dadosAntes: clienteAntes,
            dadosDepois: updated,
            ip,
            userAgent,
          },
          tx,
        );

        return updated;
      }, PRISMA_SERIALIZABLE_TX);

      return this.sanitizeCliente(clienteDepois);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'CPF/CNPJ ou E-mail já cadastrado no sistema',
        );
      }
      throw error;
    }
  }

  async remove(id: string, usuarioId: string, ip: string, userAgent: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente com ID ${id} não encontrado.`);
    }

    await this.prisma.$transaction(
      async (tx) => {
        await tx.cliente.update({
          where: { id },
          data: { deletedAt: new Date() },
        });

        await this.auditoria.registrar(
          {
            tabela: 'clientes',
            registroId: id,
            acao: AcaoAuditoria.DELETE,
            usuario: usuarioId,
            dadosAntes: cliente,
            dadosDepois: null,
            ip,
            userAgent,
          },
          tx,
        );
      },
      PRISMA_SERIALIZABLE_TX,
    );

    return { id, removed: true, timestamp: new Date() };
  }

  private sanitizeCliente(cliente: Record<string, unknown>) {
    return { ...cliente };
  }
}
