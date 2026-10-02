import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  corpoNotificacaoUnidade,
  hrefConsultaRicUnidade,
  tituloNotificacaoUnidade,
  type GateNotificacaoCampo,
  type OrigemNotificacaoUnidade,
} from './gate-unidade-notificacao.util';

type Db = Prisma.TransactionClient | PrismaService;

export type RegistrarNotificacaoUnidadeInput = {
  tenantId: string;
  unidadeProcessoId: string;
  unidadeIso: string;
  processoNumero: number;
  origem: OrigemNotificacaoUnidade;
  atorNome: string;
  atorRole: string;
  campos: GateNotificacaoCampo[];
};

export type GateUnidadeNotificacaoPublica = {
  id: string;
  titulo: string;
  corpo: string;
  origem: OrigemNotificacaoUnidade;
  unidadeIso: string;
  processoNumero: number;
  unidadeProcessoId: string;
  campos: GateNotificacaoCampo[];
  atorNome: string;
  atorRole: string;
  criadoEm: string;
  lidaEm: string | null;
  href: string;
};

function parseCampos(raw: unknown): GateNotificacaoCampo[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      return {
        campo: String(row.campo ?? ''),
        label: String(row.label ?? row.campo ?? ''),
        antes: String(row.antes ?? ''),
        depois: String(row.depois ?? ''),
      };
    })
    .filter((row): row is GateNotificacaoCampo => Boolean(row?.campo));
}

@Injectable()
export class GateUnidadeNotificacaoService {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(input: RegistrarNotificacaoUnidadeInput, db: Db = this.prisma) {
    if (!input.campos.length) return null;
    return db.gateUnidadeNotificacao.create({
      data: {
        tenantId: input.tenantId,
        unidadeProcessoId: input.unidadeProcessoId,
        unidadeIso: input.unidadeIso,
        processoNumero: input.processoNumero,
        origem: input.origem,
        titulo: tituloNotificacaoUnidade(input.processoNumero, input.campos).slice(0, 160),
        corpo: corpoNotificacaoUnidade(
          input.unidadeIso,
          input.origem,
          input.atorNome,
          input.campos,
        ),
        atorNome: input.atorNome.slice(0, 255),
        atorRole: input.atorRole.slice(0, 64),
        campos: input.campos as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async listar(tenantId: string, userId: string): Promise<GateUnidadeNotificacaoPublica[]> {
    const rows = await this.prisma.gateUnidadeNotificacao.findMany({
      where: { tenantId },
      include: {
        leituras: { where: { userId }, take: 1 },
      },
      orderBy: { criadoEm: 'desc' },
      take: 100,
    });
    return rows.map((row) => this.toPublic(row));
  }

  async contarNaoLidas(tenantId: string, userId: string): Promise<{ count: number }> {
    const count = await this.prisma.gateUnidadeNotificacao.count({
      where: {
        tenantId,
        leituras: { none: { userId } },
      },
    });
    return { count };
  }

  async marcarLida(tenantId: string, userId: string, id: string) {
    const row = await this.prisma.gateUnidadeNotificacao.findFirst({
      where: { id, tenantId },
      include: { leituras: { where: { userId }, take: 1 } },
    });
    if (!row) throw new NotFoundException('Notificação não encontrada.');
    if (!row.leituras[0]) {
      await this.prisma.gateUnidadeNotificacaoLeitura.create({
        data: { notificacaoId: id, userId },
      });
    }
    const atual = await this.prisma.gateUnidadeNotificacao.findFirst({
      where: { id, tenantId },
      include: { leituras: { where: { userId }, take: 1 } },
    });
    return this.toPublic(atual!);
  }

  async marcarTodasLidas(tenantId: string, userId: string): Promise<{ atualizadas: number }> {
    const pendentes = await this.prisma.gateUnidadeNotificacao.findMany({
      where: { tenantId, leituras: { none: { userId } } },
      select: { id: true },
    });
    if (!pendentes.length) return { atualizadas: 0 };
    const result = await this.prisma.gateUnidadeNotificacaoLeitura.createMany({
      data: pendentes.map((row) => ({ notificacaoId: row.id, userId })),
      skipDuplicates: true,
    });
    return { atualizadas: result.count };
  }

  private toPublic(row: {
    id: string;
    titulo: string;
    corpo: string;
    origem: string;
    unidadeIso: string;
    processoNumero: number;
    unidadeProcessoId: string;
    campos: Prisma.JsonValue;
    atorNome: string;
    atorRole: string;
    criadoEm: Date;
    leituras: Array<{ lidaEm: Date }>;
  }): GateUnidadeNotificacaoPublica {
    return {
      id: row.id,
      titulo: row.titulo,
      corpo: row.corpo,
      origem: row.origem === 'PORTAL' ? 'PORTAL' : 'GATE',
      unidadeIso: row.unidadeIso,
      processoNumero: row.processoNumero,
      unidadeProcessoId: row.unidadeProcessoId,
      campos: parseCampos(row.campos),
      atorNome: row.atorNome,
      atorRole: row.atorRole,
      criadoEm: row.criadoEm.toISOString(),
      lidaEm: row.leituras[0]?.lidaEm.toISOString() ?? null,
      href: hrefConsultaRicUnidade(row.unidadeIso),
    };
  }
}
