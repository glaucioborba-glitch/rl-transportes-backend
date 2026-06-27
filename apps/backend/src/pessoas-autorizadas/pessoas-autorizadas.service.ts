import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AcaoAuditoria } from '@prisma/client';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from '../auth/session/session.service';
import { parseDurationToSeconds } from '../auth/session/session.util';
import type { CxPortalRequestUser } from '../cx-portais/types/cx-portal.types';
import { CreatePessoaAutorizadaDto } from './dto/create-pessoa-autorizada.dto';
import { UpdatePessoaAutorizadaDto } from './dto/update-pessoa-autorizada.dto';
import { toPessoaSession } from './pessoa-context.util';
import type { PessoaAutorizadaSession } from './pessoa-autorizada.types';
import { PessoasPermissoesService } from '../pessoas-permissoes/pessoas-permissoes.service';
import { defaultPermissoesPessoa } from '../pessoas-permissoes/pessoa-permissoes.types';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { isTransportadoraTerceiraRole } from '../common/constants/portal-tenant-roles.util';
import { TRANSPORTADORA_PERMISSOES_FIXAS } from '../common/constants/transportadora-permissoes.constants';
import { isPortalPrincipalTenant } from '../common/constants/portal-tenant-roles.util';

@Injectable()
export class PessoasAutorizadasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly session: SessionService,
    private readonly config: ConfigService,
    private readonly permissoes: PessoasPermissoesService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private sessionTtlSeconds(): number {
    return parseDurationToSeconds(
      this.config.get<string>('PORTAL_JWT_REFRESH_EXPIRES_IN') ?? '7d',
    );
  }

  assertClienteAccess(cx: CxPortalRequestUser, clienteId: string): void {
    if (cx.portalPapel === 'STAFF') return;
    if (cx.portalPapel !== 'CLIENTE' || cx.clienteId !== clienteId) {
      throw new ForbiddenException('Acesso negado a pessoas autorizadas deste cliente.');
    }
  }

  async criar(cx: CxPortalRequestUser, dto: CreatePessoaAutorizadaDto) {
    if (!isPortalPrincipalTenant(cx)) {
      throw new ForbiddenException('Transportadoras não podem gerenciar pessoas autorizadas.');
    }
    if (cx.portalPapel !== 'CLIENTE' || !cx.clienteId) {
      throw new ForbiddenException('Somente cliente autenticado pode cadastrar pessoas autorizadas.');
    }
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: cx.clienteId, deletedAt: null },
    });
    if (!cliente) throw new NotFoundException('Cliente não encontrado');

    const cpf = dto.cpf.replace(/\D/g, '');
    const row = await this.prisma.pessoaAutorizada.create({
      data: {
        clienteId: cx.clienteId,
        nome: dto.nome.trim(),
        email: dto.email.trim().toLowerCase(),
        cpf,
        telefone: dto.telefone?.replace(/\D/g, '') || null,
        permissoes: {
          create: this.permissoes.mergeInput(dto.permissoes),
        },
      },
      include: { permissoes: true },
    });
    return row;
  }

  async listarPorCliente(cx: CxPortalRequestUser, clienteId: string, apenasAtivas = false) {
    this.assertClienteAccess(cx, clienteId);
    return this.prisma.pessoaAutorizada.findMany({
      where: {
        clienteId,
        ...(apenasAtivas ? { ativo: true } : {}),
      },
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    });
  }

  async remover(cx: CxPortalRequestUser, id: string) {
    const row = await this.prisma.pessoaAutorizada.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Pessoa autorizada não encontrada');
    this.assertClienteAccess(cx, row.clienteId);
    await this.prisma.pessoaAutorizada.delete({ where: { id } });
    return { ok: true as const };
  }

  async atualizar(cx: CxPortalRequestUser, id: string, dto: UpdatePessoaAutorizadaDto) {
    const row = await this.prisma.pessoaAutorizada.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Pessoa autorizada não encontrada');
    this.assertClienteAccess(cx, row.clienteId);
    if (dto.ativo === undefined) {
      throw new BadRequestException('Informe ativo=true ou ativo=false.');
    }
    return this.prisma.pessoaAutorizada.update({
      where: { id },
      data: { ativo: dto.ativo },
    });
  }

  async criarEmLote(clienteId: string, pessoas: CreatePessoaAutorizadaDto[]): Promise<void> {
    if (!pessoas.length) return;
    for (const p of pessoas) {
      await this.prisma.pessoaAutorizada.create({
        data: {
          clienteId,
          nome: p.nome.trim(),
          email: p.email.trim().toLowerCase(),
          cpf: p.cpf.replace(/\D/g, ''),
          telefone: p.telefone?.replace(/\D/g, '') || null,
          permissoes: {
            create: this.permissoes.mergeInput(p.permissoes),
          },
        },
      });
    }
  }

  /** Validação cega por CPF — substitui listagem pós-login. */
  async validarPessoaPorCpf(
    cx: CxPortalRequestUser,
    cpfRaw: string,
    req?: Request,
  ): Promise<PessoaAutorizadaSession> {
    if (cx.portalPapel !== 'CLIENTE' || !cx.clienteId) {
      throw new ForbiddenException('Somente cliente autenticado no portal.');
    }
    const cpf = cpfRaw.replace(/\D/g, '');
    if (cpf.length !== 11) {
      throw new UnauthorizedException(
        'CPF não encontrado ou não autorizado para esta empresa.',
      );
    }
    const row = await this.prisma.pessoaAutorizada.findFirst({
      where: { cpf, clienteId: cx.clienteId, ativo: true },
    });
    if (!row) {
      throw new UnauthorizedException(
        'CPF não encontrado ou não autorizado para esta empresa.',
      );
    }
    return this.escolherPessoa(cx, row.id, req);
  }

  async escolherPessoa(
    cx: CxPortalRequestUser,
    pessoaId: string,
    req?: Request,
  ): Promise<PessoaAutorizadaSession> {
    if (cx.portalPapel !== 'CLIENTE' || !cx.clienteId) {
      throw new ForbiddenException('Somente cliente autenticado no portal.');
    }
    if (!cx.sid?.trim()) {
      throw new BadRequestException('Sessão portal sem identificador (sid). Faça login novamente.');
    }
    const row = await this.prisma.pessoaAutorizada.findFirst({
      where: { id: pessoaId, clienteId: cx.clienteId, ativo: true },
    });
    if (!row) throw new NotFoundException('Pessoa autorizada não encontrada ou inativa.');
    const snapshot = toPessoaSession(row);
    const permissoes = await this.permissoes.obterPermissoesAtivas(row.id);
    const ok = await this.session.setPessoaAutorizada(
      cx.sub,
      cx.sid,
      snapshot,
      this.sessionTtlSeconds(),
      permissoes,
    );
    if (!ok) throw new BadRequestException('Sessão expirada. Faça login novamente.');
    await this.registrarLoginPessoaAutorizada(cx, snapshot, req);
    return snapshot;
  }

  /** Bootstrap pós-login — nunca lança erro; retorna envelope seguro. */
  async bootstrapMinhasPermissoes(cx: CxPortalRequestUser) {
    const defaults = defaultPermissoesPessoa();
    try {
      if (cx.portalPapel !== 'CLIENTE') {
        return this.envelopePermissoes(defaults, null);
      }
      if (cx.portalTenantRole && isTransportadoraTerceiraRole(cx.portalTenantRole)) {
        const pessoa =
          cx.pessoaAutorizada ??
          (cx.transportadoraId
            ? {
                id: cx.transportadoraId,
                nome: '',
                email: cx.email,
                telefone: null,
              }
            : null);
        return this.envelopePermissoes(
          cx.permissoesPessoa ?? TRANSPORTADORA_PERMISSOES_FIXAS,
          pessoa,
          false,
        );
      }
      let pessoa = cx.pessoaAutorizada ?? null;
      let permissoes = cx.permissoesPessoa ?? null;
      if (cx.sid?.trim()) {
        const sess = await this.session.getSession(cx.sub, cx.sid);
        pessoa = sess?.pessoaAutorizada ?? pessoa;
        permissoes = sess?.permissoesPessoa ?? permissoes;
      }
      if (!permissoes && pessoa?.id) {
        try {
          permissoes = await this.permissoes.obterPermissoesAtivas(pessoa.id);
        } catch (err) {
          await this.registrarFalhaPermissaoPortal(cx, err);
          permissoes = defaults;
        }
      }
      return this.envelopePermissoes(permissoes ?? defaults, pessoa);
    } catch (err) {
      await this.registrarFalhaPermissaoPortal(cx, err);
      return this.envelopePermissoes(defaults, null);
    }
  }

  private envelopePermissoes(
    permissoes: ReturnType<typeof defaultPermissoesPessoa>,
    pessoa: PessoaAutorizadaSession | null,
    precisaSelecionarPessoa = !pessoa,
  ) {
    return {
      sucesso: true as const,
      permissoes,
      pessoa: pessoa ?? null,
      precisaSelecionarPessoa,
    };
  }

  private async registrarLoginPessoaAutorizada(
    cx: CxPortalRequestUser,
    pessoa: PessoaAutorizadaSession,
    req?: Request,
  ): Promise<void> {
    const payload = {
      clienteCNPJ: cx.cpfCnpj.replace(/\D/g, ''),
      pessoaId: pessoa.id,
      nome: pessoa.nome,
      email: pessoa.email,
    };
    try {
      await this.auditoria.registrar({
        tabela: 'pessoa_autorizada',
        registroId: pessoa.id,
        acao: AcaoAuditoria.READ,
        usuario: cx.sub,
        dadosDepois: { evento: 'LOGIN_PESSOA_AUTORIZADA', ...payload },
        ip: req?.ip,
        userAgent: req?.get?.('user-agent') ?? undefined,
      });
    } catch {
      /* auditoria não bloqueia fluxo pós-login */
    }
  }

  private async registrarFalhaPermissaoPortal(
    cx: CxPortalRequestUser,
    err: unknown,
    req?: Request,
  ): Promise<void> {
    const payload = {
      clienteCNPJ: cx.cpfCnpj.replace(/\D/g, ''),
      pessoaId: cx.pessoaAutorizada?.id ?? null,
      motivo: err instanceof Error ? err.message : String(err ?? 'unknown'),
    };
    try {
      await this.auditoria.registrar({
        tabela: 'pessoa_permissoes',
        registroId: cx.pessoaAutorizada?.id ?? cx.sub,
        acao: AcaoAuditoria.READ,
        usuario: cx.sub,
        dadosDepois: { evento: 'FALHA_PERMISSAO_PORTAL', ...payload },
        ip: req?.ip,
        userAgent: req?.get?.('user-agent') ?? undefined,
      });
    } catch {
      /* falha de permissão/CORS não bloqueia resposta safe */
    }
  }

  async pessoaAtual(cx: CxPortalRequestUser): Promise<PessoaAutorizadaSession | null> {
    if (cx.portalPapel !== 'CLIENTE' || !cx.sid?.trim()) return null;
    const sess = await this.session.getSession(cx.sub, cx.sid);
    return sess?.pessoaAutorizada ?? null;
  }

  async permissoesAtuais(cx: CxPortalRequestUser) {
    return this.permissoes.minhasPermissoes(cx);
  }
}
