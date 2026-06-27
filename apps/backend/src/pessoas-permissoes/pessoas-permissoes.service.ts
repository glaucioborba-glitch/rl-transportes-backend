import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AcaoAuditoria } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { SecurityEventsService } from '../security-center/security-events.service';
import type { CxPortalRequestUser } from '../cx-portais/types/cx-portal.types';
import type { PermissoesPessoaInputDto } from './dto/update-permissoes.dto';
import {
  defaultPermissoesPessoa,
  hasPermissao,
  permissoesFromRow,
  type PermissoesPessoaSession,
  type PessoaPermissaoKey,
} from './pessoa-permissoes.types';
import { isTransportadoraTerceiraRole } from '../common/constants/portal-tenant-roles.util';
import { TRANSPORTADORA_PERMISSOES_FIXAS } from '../common/constants/transportadora-permissoes.constants';

@Injectable()
export class PessoasPermissoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly securityEvents: SecurityEventsService,
  ) {}

  mergeInput(input?: PermissoesPessoaInputDto): PermissoesPessoaSession {
    const base = defaultPermissoesPessoa();
    if (!input) return base;
    return {
      podeCriarSolicitacao: input.podeCriarSolicitacao ?? base.podeCriarSolicitacao,
      podeAnexarDocumentos: input.podeAnexarDocumentos ?? base.podeAnexarDocumentos,
      podeAgendarTurno: input.podeAgendarTurno ?? base.podeAgendarTurno,
      podeVisualizarFinanceiro: input.podeVisualizarFinanceiro ?? base.podeVisualizarFinanceiro,
      podeAprovarOS: input.podeAprovarOS ?? base.podeAprovarOS,
      podeVerOS: input.podeVerOS ?? base.podeVerOS,
      podeAlterarDadosGate: input.podeAlterarDadosGate ?? base.podeAlterarDadosGate,
      podeGerarPDF: input.podeGerarPDF ?? base.podeGerarPDF,
      podeGerenciarPessoas: input.podeGerenciarPessoas ?? base.podeGerenciarPessoas,
    };
  }

  async criarParaPessoa(pessoaId: string, input?: PermissoesPessoaInputDto) {
    const data = this.mergeInput(input);
    return this.prisma.permissaoPessoaAutorizada.create({
      data: { pessoaId, ...data },
    });
  }

  async obterPorPessoaId(pessoaId: string): Promise<PermissoesPessoaSession> {
    const row = await this.prisma.permissaoPessoaAutorizada.findUnique({ where: { pessoaId } });
    if (!row) return defaultPermissoesPessoa();
    return permissoesFromRow(row);
  }

  async obterRegistroPorPessoaId(pessoaId: string, cx?: CxPortalRequestUser) {
    const pessoa = await this.prisma.pessoaAutorizada.findUnique({
      where: { id: pessoaId },
      include: { permissoes: true },
    });
    if (!pessoa) throw new NotFoundException('Pessoa autorizada não encontrada');
    if (cx && cx.portalPapel !== 'STAFF' && cx.clienteId !== pessoa.clienteId) {
      throw new ForbiddenException('Acesso negado.');
    }
    if (!pessoa.permissoes) {
      const created = await this.criarParaPessoa(pessoaId);
      return { pessoa, permissoes: created };
    }
    return { pessoa, permissoes: pessoa.permissoes };
  }

  async upsert(cx: CxPortalRequestUser, pessoaId: string, dto: PermissoesPessoaInputDto) {
    await this.assertPodeGerenciar(cx, pessoaId);
    const merged = this.mergeInput(dto);
    return this.prisma.permissaoPessoaAutorizada.upsert({
      where: { pessoaId },
      create: { pessoaId, ...merged },
      update: merged,
    });
  }

  async atualizar(cx: CxPortalRequestUser, pessoaId: string, dto: PermissoesPessoaInputDto) {
    await this.assertPodeGerenciar(cx, pessoaId);
    const existing = await this.prisma.permissaoPessoaAutorizada.findUnique({ where: { pessoaId } });
    if (!existing) {
      return this.criarParaPessoa(pessoaId, dto);
    }
    const patch: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(dto)) {
      if (v !== undefined) patch[k] = v as boolean;
    }
    if (!Object.keys(patch).length) return existing;
    return this.prisma.permissaoPessoaAutorizada.update({
      where: { pessoaId },
      data: patch,
    });
  }

  async minhasPermissoes(cx: CxPortalRequestUser): Promise<PermissoesPessoaSession | null> {
    if (cx.portalPapel !== 'CLIENTE' || !cx.pessoaAutorizada?.id) return null;
    return this.obterPermissoesAtivas(cx.pessoaAutorizada.id);
  }

  async obterPermissoesAtivas(pessoaId: string): Promise<PermissoesPessoaSession> {
    const pessoa = await this.prisma.pessoaAutorizada.findUnique({
      where: { id: pessoaId },
      include: { permissoes: true },
    });
    if (!pessoa || !pessoa.ativo) {
      throw new ForbiddenException('Pessoa autorizada inativa ou não encontrada.');
    }
    if (!pessoa.permissoes) return defaultPermissoesPessoa();
    return permissoesFromRow(pessoa.permissoes);
  }

  async assertPermissao(
    cx: CxPortalRequestUser,
    keys: PessoaPermissaoKey[],
    req?: Request,
  ): Promise<PermissoesPessoaSession> {
    if (cx.portalPapel === 'STAFF') {
      return defaultPermissoesPessoa();
    }
    if (cx.portalPapel !== 'CLIENTE') {
      throw new ForbiddenException('Seu perfil não possui permissão para executar esta ação.');
    }
    if (cx.portalTenantRole && isTransportadoraTerceiraRole(cx.portalTenantRole)) {
      const permissoes = cx.permissoesPessoa ?? TRANSPORTADORA_PERMISSOES_FIXAS;
      const negadas = keys.filter((k) => !hasPermissao(permissoes, k));
      if (negadas.length) {
        await this.registrarPermissaoNegada(cx, negadas[0]!, req);
        throw new ForbiddenException('Seu perfil não possui permissão para executar esta ação.');
      }
      return permissoes;
    }
    if (!cx.pessoaAutorizada?.id) {
      throw new ForbiddenException('Selecione sua identidade antes de continuar.');
    }
    const permissoes = await this.obterPermissoesAtivas(cx.pessoaAutorizada.id);
    const negadas = keys.filter((k) => !hasPermissao(permissoes, k));
    if (negadas.length) {
      await this.registrarPermissaoNegada(cx, negadas[0]!, req);
      throw new ForbiddenException('Seu perfil não possui permissão para executar esta ação.');
    }
    return permissoes;
  }

  private async assertPodeGerenciar(cx: CxPortalRequestUser, pessoaId: string) {
    const pessoa = await this.prisma.pessoaAutorizada.findUnique({ where: { id: pessoaId } });
    if (!pessoa) throw new NotFoundException('Pessoa autorizada não encontrada');
    if (cx.portalPapel === 'STAFF') return;
    if (cx.portalPapel !== 'CLIENTE' || cx.clienteId !== pessoa.clienteId) {
      throw new ForbiddenException('Acesso negado.');
    }
    if (!cx.pessoaAutorizada?.id) {
      throw new ForbiddenException('Selecione sua identidade antes de continuar.');
    }
    const permissoes = await this.obterPermissoesAtivas(cx.pessoaAutorizada.id);
    if (!permissoes.podeGerenciarPessoas) {
      throw new ForbiddenException('Seu perfil não possui permissão para executar esta ação.');
    }
  }

  private async registrarPermissaoNegada(
    cx: CxPortalRequestUser,
    permissao: PessoaPermissaoKey,
    req?: Request,
  ) {
    const pessoa = cx.pessoaAutorizada;
    const payload = {
      cnpjCliente: cx.cpfCnpj.replace(/\D/g, ''),
      pessoaId: pessoa?.id ?? null,
      nome: pessoa?.nome ?? null,
      email: pessoa?.email ?? null,
      telefone: pessoa?.telefone ?? null,
      permissaoNegada: permissao,
      rota: req?.originalUrl ?? req?.url ?? null,
    };
    try {
      await this.auditoria.registrar({
        tabela: 'pessoa_permissoes',
        registroId: pessoa?.id ?? cx.sub,
        acao: AcaoAuditoria.READ,
        usuario: cx.sub,
        dadosDepois: { evento: 'LOG_EVENTO_PERMISSAO_NEGADA', ...payload },
        ip: req?.ip,
        userAgent: req?.get?.('user-agent') ?? undefined,
      });
    } catch {
      /* não bloquear */
    }
    this.securityEvents.emit({
      type: 'CRITICAL_EVENT',
      tipo: 'LOG_EVENTO_PERMISSAO_NEGADA',
      userId: cx.sub,
      contexto: payload,
    });
  }
}
