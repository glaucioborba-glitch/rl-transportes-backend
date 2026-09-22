import { Injectable } from '@nestjs/common';
import { AcaoAuditoria, CategoriaAuditLog, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuditTrailQueryDto } from './dto/audit-trail-query.dto';
import {
  classificarAcaoAuditoria,
  type ClassificacaoAuditoria,
} from './classificacao-auditoria.util';
import { extractAuditMudancas, type AuditMudancaUi } from './audit-diff.util';
import {
  formatarAtorAuditoria,
  resolveAuditAtor,
  rotuloEmpresaCliente,
  type AuditAtorTipo,
} from './audit-ator.util';

export type AuditTrailUiItem = {
  id: string;
  criadoEm: string;
  categoria: CategoriaAuditLog;
  classificacao: ClassificacaoAuditoria;
  fonte: 'narrativa' | 'tecnica' | 'portal';
  acao: string;
  tabela?: string | null;
  containerIso: string | null;
  descricaoNarrativa: string;
  usuarioId: string;
  usuarioNome: string;
  usuarioRole: string;
  atorTipo: AuditAtorTipo;
  empresaNome: string | null;
  operadorNome: string;
  mudancas: AuditMudancaUi[];
  ipAddress: string | null;
  dadosAnteriores: unknown;
  dadosNovos: unknown;
};

const JANELA_MERGE = 400;
const PORTAL_ACOES_RUIDO = [
  'portal_login',
  'portal_refresh',
  'portal_login_view',
  'dashboard_visualizacao',
  'solicitacoes_listagem',
];

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

function portalBody(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  const o = payload as Record<string, unknown>;
  if (o.body && typeof o.body === 'object' && !Array.isArray(o.body)) {
    return o.body as Record<string, unknown>;
  }
  return o;
}

function categoriaPorTabela(tabela: string): CategoriaAuditLog {
  if (/fatur|boleto|nfs|pre_fatura|cliente/i.test(tabela)) return CategoriaAuditLog.FINANCEIRO;
  if (/user|sessao|auth|segur/i.test(tabela)) return CategoriaAuditLog.SEGURANCA;
  if (/solicit|gate|patio|portaria|unidade/i.test(tabela)) return CategoriaAuditLog.OPERACIONAL;
  return CategoriaAuditLog.SISTEMA;
}

function decorateItem(
  base: Omit<AuditTrailUiItem, 'atorTipo' | 'empresaNome' | 'operadorNome' | 'mudancas'>,
): AuditTrailUiItem {
  const ator = resolveAuditAtor({
    usuarioNome: base.usuarioNome,
    usuarioRole: base.usuarioRole,
    dadosNovos: base.dadosNovos,
    dadosAnteriores: base.dadosAnteriores,
  });
  const mudancas = extractAuditMudancas(base.dadosAnteriores, base.dadosNovos);
  const descricao =
    base.descricaoNarrativa?.trim() ||
    `${formatarAtorAuditoria(ator)} registrou ${base.acao.replace(/_/g, ' ').toLowerCase()}.`;
  return {
    ...base,
    descricaoNarrativa: descricao,
    atorTipo: ator.tipo,
    empresaNome: ator.empresaNome,
    operadorNome: ator.operadorNome,
    mudancas,
  };
}

function clienteIdFromPayload(...payloads: unknown[]): string | null {
  for (const p of payloads) {
    if (!p || typeof p !== 'object') continue;
    const o = p as Record<string, unknown>;
    const rec = o.record && typeof o.record === 'object' ? (o.record as Record<string, unknown>) : o;
    const id = rec.clienteId ?? rec.cliente_id;
    if (typeof id === 'string' && id.trim()) return id;
  }
  return null;
}

@Injectable()
export class AuditTrailService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(tenantId: string, query: AuditTrailQueryDto): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = { tenantId };

    if (query.categoria) where.categoria = query.categoria;
    if (query.usuarioId) where.usuarioId = query.usuarioId;
    if (query.acao) where.acao = query.acao;
    if (query.containerIso) {
      where.containerIso = { contains: query.containerIso.replace(/\s/g, ''), mode: 'insensitive' };
    }

    if (query.dataInicio || query.dataFim) {
      where.criadoEm = {};
      if (query.dataInicio) where.criadoEm.gte = new Date(query.dataInicio);
      if (query.dataFim) {
        const fim = new Date(query.dataFim);
        fim.setHours(23, 59, 59, 999);
        where.criadoEm.lte = fim;
      }
    }

    const q = query.q?.trim();
    if (q) {
      const protocoloMatch: Prisma.AuditLogWhereInput[] = [
        { containerIso: { contains: q.replace(/\s/g, ''), mode: 'insensitive' } },
        { usuarioNome: { contains: q, mode: 'insensitive' } },
        { descricaoNarrativa: { contains: q, mode: 'insensitive' } },
        { acao: { contains: q.replace(/\s/g, '_').toUpperCase(), mode: 'insensitive' } },
      ];
      where.OR = protocoloMatch;
    }

    return where;
  }

  private buildLegacyWhere(query: AuditTrailQueryDto): Prisma.AuditoriaWhereInput {
    const where: Prisma.AuditoriaWhereInput = {
      tabela: { notIn: ['auditoria_consulta', 'cx_portal'] },
      acao: { not: AcaoAuditoria.READ },
    };
    if (query.usuarioId) where.usuario = query.usuarioId;
    if (query.acao && ['INSERT', 'UPDATE', 'DELETE', 'SEGURANCA'].includes(query.acao)) {
      where.acao = query.acao as AcaoAuditoria;
    }
    if (query.dataInicio || query.dataFim) {
      where.createdAt = {};
      if (query.dataInicio) where.createdAt.gte = new Date(query.dataInicio);
      if (query.dataFim) {
        const fim = new Date(query.dataFim);
        fim.setHours(23, 59, 59, 999);
        where.createdAt.lte = fim;
      }
    }
    const q = query.q?.trim();
    if (q) {
      where.OR = [
        { tabela: { contains: q, mode: 'insensitive' } },
        { registroId: { contains: q, mode: 'insensitive' } },
        { usuario: { contains: q, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  private toUiFromLog(r: {
    id: string;
    criadoEm: Date;
    categoria: CategoriaAuditLog;
    acao: string;
    containerIso: string | null;
    descricaoNarrativa: string;
    usuarioId: string;
    usuarioNome: string;
    usuarioRole: string;
    ipAddress: string | null;
    dadosAnteriores: unknown;
    dadosNovos: unknown;
    entidadeTipo?: string;
  }): AuditTrailUiItem {
    return decorateItem({
      id: r.id,
      criadoEm: r.criadoEm.toISOString(),
      categoria: r.categoria,
      classificacao: classificarAcaoAuditoria({
        acao: r.acao,
        categoria: r.categoria,
        tabela: r.entidadeTipo,
        dadosNovos: r.dadosNovos,
        dadosAnteriores: r.dadosAnteriores,
      }),
      fonte: 'narrativa',
      acao: r.acao,
      tabela: r.entidadeTipo ?? null,
      containerIso: r.containerIso,
      descricaoNarrativa: r.descricaoNarrativa,
      usuarioId: r.usuarioId,
      usuarioNome: r.usuarioNome,
      usuarioRole: r.usuarioRole,
      ipAddress: r.ipAddress,
      dadosAnteriores: r.dadosAnteriores,
      dadosNovos: r.dadosNovos,
    });
  }

  private toUiFromLegacy(r: {
    id: string;
    createdAt: Date;
    tabela: string;
    registroId: string;
    acao: AcaoAuditoria;
    usuario: string;
    dadosAntes: unknown;
    dadosDepois: unknown;
  }): AuditTrailUiItem {
    const categoria = categoriaPorTabela(r.tabela);
    const rotuloAcao =
      r.acao === AcaoAuditoria.INSERT
        ? 'inclusão'
        : r.acao === AcaoAuditoria.UPDATE
          ? 'alteração'
          : r.acao === AcaoAuditoria.DELETE
            ? 'exclusão'
            : r.acao.toLowerCase();
    return decorateItem({
      id: `tec-${r.id}`,
      criadoEm: r.createdAt.toISOString(),
      categoria,
      classificacao: classificarAcaoAuditoria({
        acao: r.acao,
        categoria,
        tabela: r.tabela,
        dadosNovos: r.dadosDepois,
        dadosAnteriores: r.dadosAntes,
      }),
      fonte: 'tecnica',
      acao: r.acao,
      tabela: r.tabela,
      containerIso: null,
      descricaoNarrativa: `${rotuloAcao} em ${r.tabela} (${r.registroId.slice(0, 8)})`,
      usuarioId: r.usuario,
      usuarioNome: r.usuario,
      usuarioRole: '',
      ipAddress: null,
      dadosAnteriores: r.dadosAntes,
      dadosNovos: r.dadosDepois,
    });
  }

  private toUiFromPortal(r: {
    id: string;
    createdAt: Date;
    acao: string;
    rota: string;
    metodoHttp: string;
    clienteId: string | null;
    usuarioPortalId: string | null;
    payloadEnviado: unknown;
    resultado: unknown;
    ip: string;
  }): AuditTrailUiItem {
    const acao = r.metodoHttp === 'DELETE' ? 'DELETE' : r.metodoHttp === 'POST' ? 'INSERT' : 'UPDATE';
    const body = portalBody(r.payloadEnviado);
    const iso = typeof body.numeroIso === 'string' ? body.numeroIso : typeof body.unidade === 'string' ? body.unidade : null;
    return decorateItem({
      id: `portal-${r.id}`,
      criadoEm: r.createdAt.toISOString(),
      categoria: CategoriaAuditLog.OPERACIONAL,
      classificacao: classificarAcaoAuditoria({ acao, tabela: 'portal' }),
      fonte: 'portal',
      acao: r.acao,
      tabela: 'portal',
      containerIso: iso,
      descricaoNarrativa: `Ação do portal: ${r.acao.replace(/_/g, ' ')}`,
      usuarioId: r.usuarioPortalId ?? '',
      usuarioNome: r.usuarioPortalId ?? 'Portal',
      usuarioRole: 'CLIENTE',
      ipAddress: r.ip,
      dadosAnteriores: null,
      dadosNovos: {
        ...body,
        clienteId: r.clienteId,
        ator: { tipo: 'cliente' },
      },
    });
  }

  private portalWhere(clienteIds: string[], query: AuditTrailQueryDto): Prisma.PortalAuditoriaWhereInput {
    const where: Prisma.PortalAuditoriaWhereInput = {
      clienteId: { in: clienteIds },
      metodoHttp: { in: ['POST', 'PATCH', 'PUT', 'DELETE'] },
      AND: [
        { acao: { notIn: PORTAL_ACOES_RUIDO } },
        { NOT: { acao: { startsWith: 'get_' } } },
        { NOT: { rota: { contains: '/solicitacoes' } } },
        { NOT: { rota: { contains: 'pessoas-autorizadas' } } },
        { NOT: { rota: { contains: '/portal/auth' } } },
        { NOT: { rota: { contains: '/notificacoes' } } },
        { NOT: { rota: { contains: 'simulacao-valores' } } },
      ],
    };
    if (query.dataInicio || query.dataFim) {
      where.createdAt = {};
      if (query.dataInicio) where.createdAt.gte = new Date(query.dataInicio);
      if (query.dataFim) {
        const fim = new Date(query.dataFim);
        fim.setHours(23, 59, 59, 999);
        where.createdAt.lte = fim;
      }
    }
    return where;
  }

  private async nomesClientes(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return new Map();
    const rows = await this.prisma.cliente.findMany({
      where: { id: { in: unique } },
      select: { id: true, razaoSocial: true, nomeFantasia: true },
    });
    return new Map(rows.map((c) => [c.id, rotuloEmpresaCliente(c) ?? c.razaoSocial]));
  }

  private async nomesOperadores(userIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (!unique.length) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, email: true },
    });
    const emails = users.map((u) => u.email).filter(Boolean);
    const pessoas = emails.length
      ? await this.prisma.pessoaAutorizada.findMany({
          where: { email: { in: emails } },
          select: { email: true, nome: true },
        })
      : [];
    const nomePorEmail = new Map(pessoas.map((p) => [p.email.toLowerCase(), p.nome]));
    return new Map(
      users.map((u) => [u.id, nomePorEmail.get(u.email.toLowerCase()) ?? u.email]),
    );
  }

  private async hidratarAtores(items: AuditTrailUiItem[]): Promise<AuditTrailUiItem[]> {
    const clienteIds = items
      .map((i) => clienteIdFromPayload(i.dadosNovos, i.dadosAnteriores))
      .filter((id): id is string => Boolean(id));
    const userIds = items
      .filter((i) => i.usuarioId && (i.fonte === 'portal' || i.atorTipo === 'cliente' || looksLikeUuid(i.usuarioId)))
      .map((i) => i.usuarioId);
    const [empresas, operadores] = await Promise.all([
      this.nomesClientes(clienteIds),
      this.nomesOperadores(userIds),
    ]);
    return items.map((i) => {
      const cid = clienteIdFromPayload(i.dadosNovos, i.dadosAnteriores);
      const ehCliente = i.fonte === 'portal' || i.atorTipo === 'cliente';
      const empresaNome = ehCliente ? i.empresaNome || (cid ? empresas.get(cid) ?? null : null) : null;
      const operadorNome =
        looksLikeUuid(i.operadorNome) || i.operadorNome === i.usuarioId
          ? operadores.get(i.usuarioId) ?? i.operadorNome
          : i.operadorNome;
      const atorTipo = ehCliente ? 'cliente' : i.atorTipo;
      return {
        ...i,
        atorTipo,
        empresaNome,
        operadorNome,
        usuarioNome:
          atorTipo === 'cliente'
            ? formatarAtorAuditoria({ tipo: 'cliente', empresaNome, operadorNome, papel: i.usuarioRole })
            : i.usuarioNome,
      };
    });
  }

  private async mergeItems(tenantId: string, query: AuditTrailQueryDto, take: number): Promise<AuditTrailUiItem[]> {
    const logWhere = this.buildWhere(tenantId, query);
    const legacyWhere = this.buildLegacyWhere(query);
    const clientesTenant = await this.prisma.cliente.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true },
      take: 2000,
    });
    const clienteIdsTenant = clientesTenant.map((c) => c.id);
    const [logs, legacy, portal] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: logWhere,
        orderBy: { criadoEm: 'desc' },
        take,
      }),
      this.prisma.auditoria.findMany({
        where: legacyWhere,
        orderBy: { createdAt: 'desc' },
        take,
      }),
      clienteIdsTenant.length
        ? this.prisma.portalAuditoria.findMany({
            where: this.portalWhere(clienteIdsTenant, query),
            orderBy: { createdAt: 'desc' },
            take,
          })
        : Promise.resolve([]),
    ]);
    return this.hidratarAtores(
      [
        ...logs.map((r) => this.toUiFromLog(r)),
        ...legacy.map((r) => this.toUiFromLegacy(r)),
        ...portal.map((r) => this.toUiFromPortal(r)),
      ].sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()),
    );
  }

  async list(tenantId: string, query: AuditTrailQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 30, 100);
    const skip = (page - 1) * limit;

    let items = await this.mergeItems(tenantId, query, JANELA_MERGE);

    const q = query.q?.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (i) =>
          i.descricaoNarrativa.toLowerCase().includes(q) ||
          i.usuarioNome.toLowerCase().includes(q) ||
          (i.empresaNome ?? '').toLowerCase().includes(q) ||
          i.operadorNome.toLowerCase().includes(q) ||
          i.acao.toLowerCase().includes(q) ||
          (i.containerIso ?? '').toLowerCase().includes(q),
      );
    }

    const resumo = {
      verde: items.filter((i) => i.classificacao === 'VERDE').length,
      amarelo: items.filter((i) => i.classificacao === 'AMARELO').length,
      vermelho: items.filter((i) => i.classificacao === 'VERMELHO').length,
    };

    if (query.classificacao) {
      items = items.filter((i) => i.classificacao === query.classificacao);
    }

    const total = items.length;
    const pageItems = items.slice(skip, skip + limit);

    return {
      items: pageItems,
      meta: { total, page, limit, totalPages: total === 0 ? 0 : Math.ceil(total / limit) },
      resumo,
    };
  }

  async listUsuarios(tenantId: string) {
    const rows = await this.prisma.auditLog.findMany({
      where: { tenantId },
      distinct: ['usuarioId'],
      select: { usuarioId: true, usuarioNome: true },
      orderBy: { usuarioNome: 'asc' },
      take: 200,
    });
    return rows;
  }

  async listAcoes(tenantId: string) {
    const rows = await this.prisma.auditLog.findMany({
      where: { tenantId },
      distinct: ['acao'],
      select: { acao: true },
      orderBy: { acao: 'asc' },
      take: 100,
    });
    return rows.map((r) => r.acao);
  }

  buildCsv(items: AuditTrailUiItem[]): string {
    const header = [
      'Data/Hora',
      'Classificação',
      'Categoria',
      'Ação',
      'Empresa',
      'Operador',
      'Contêiner',
      'Descrição',
      'Como estava → Como ficou',
      'IP',
    ];
    const lines = items.map((i) =>
      [
        i.criadoEm,
        i.classificacao,
        i.categoria,
        i.acao,
        i.empresaNome ?? '',
        i.operadorNome,
        i.containerIso ?? '',
        i.descricaoNarrativa.replace(/"/g, '""'),
        i.mudancas.map((m) => `${m.label}: ${m.antes} → ${m.depois}`).join(' | ').replace(/"/g, '""'),
        i.ipAddress ?? '',
      ]
        .map((c) => `"${c}"`)
        .join(','),
    );
    return `\uFEFF${header.join(',')}\n${lines.join('\n')}`;
  }

  async export(tenantId: string, query: AuditTrailQueryDto) {
    let items = await this.mergeItems(tenantId, query, 5000);
    const q = query.q?.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (i) =>
          i.descricaoNarrativa.toLowerCase().includes(q) ||
          i.usuarioNome.toLowerCase().includes(q) ||
          (i.empresaNome ?? '').toLowerCase().includes(q) ||
          i.operadorNome.toLowerCase().includes(q) ||
          i.acao.toLowerCase().includes(q) ||
          (i.containerIso ?? '').toLowerCase().includes(q),
      );
    }
    if (query.classificacao) {
      items = items.filter((i) => i.classificacao === query.classificacao);
    }
    return items.slice(0, 5000);
  }
}
