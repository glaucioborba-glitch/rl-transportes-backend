import { Prisma, StatusUnidadeProcesso } from '@prisma/client';

export type ConsultaRicDirecao = 'ENTRADA' | 'SAIDA' | 'TODAS';
export type ConsultaRicStatus = 'ABERTO' | 'ENCERRADO' | 'TODOS';

export type ConsultaRicFiltro = {
  q?: string;
  direcao?: ConsultaRicDirecao;
  de?: string;
  ate?: string;
  status?: ConsultaRicStatus;
};

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function parseDay(iso?: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso?.trim() ?? '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Últimos 10 dias (hoje inclusive) se de/até não vierem. */
export function janelaConsultaRic(de?: string, ate?: string): { inicio: Date; fim: Date } {
  const ateD = parseDay(ate) ?? new Date();
  const fim = endOfLocalDay(ateD);
  const deD = parseDay(de);
  const inicio = startOfLocalDay(
    deD ?? new Date(ateD.getFullYear(), ateD.getMonth(), ateD.getDate() - 9),
  );
  return { inicio, fim };
}

export function prismaWhereConsultaRic(
  tenantId: string,
  filtro: ConsultaRicFiltro,
): Prisma.UnidadeProcessoWhereInput {
  const { inicio, fim } = janelaConsultaRic(filtro.de, filtro.ate);
  const direcao = filtro.direcao ?? 'TODAS';
  const periodo: Prisma.UnidadeProcessoWhereInput =
    direcao === 'ENTRADA'
      ? { entradaEm: { gte: inicio, lte: fim } }
      : direcao === 'SAIDA'
        ? { saidaEm: { gte: inicio, lte: fim } }
        : {
            OR: [
              { entradaEm: { gte: inicio, lte: fim } },
              { saidaEm: { gte: inicio, lte: fim } },
            ],
          };

  const status =
    filtro.status === 'ABERTO' || filtro.status === 'ENCERRADO'
      ? { status: filtro.status as StatusUnidadeProcesso }
      : {};

  const q = filtro.q?.trim();
  const busca: Prisma.UnidadeProcessoWhereInput = q
    ? {
        OR: [
          ...( /^\d+$/.test(q) ? [{ numero: Number(q) }] : []),
          { unidadeIso: { contains: q.replace(/[\s-]/g, '').toUpperCase(), mode: 'insensitive' as const } },
          { cliente: { nomeFantasia: { contains: q, mode: 'insensitive' as const } } },
          { cliente: { razaoSocial: { contains: q, mode: 'insensitive' as const } } },
          {
            entradaSolicitacao: {
              cliente: { nomeFantasia: { contains: q, mode: 'insensitive' as const } },
            },
          },
          {
            entradaSolicitacao: {
              cliente: { razaoSocial: { contains: q, mode: 'insensitive' as const } },
            },
          },
          { entradaSolicitacao: { protocolo: { contains: q, mode: 'insensitive' as const } } },
          { saidaSolicitacao: { protocolo: { contains: q, mode: 'insensitive' as const } } },
          {
            entradaSolicitacao: {
              containersSolicitacao: { some: { booking: { contains: q, mode: 'insensitive' as const } } },
            },
          },
          {
            saidaSolicitacao: {
              containersSolicitacao: { some: { booking: { contains: q, mode: 'insensitive' as const } } },
            },
          },
        ],
      }
    : {};

  return {
    tenantId,
    ...status,
    AND: [periodo, ...(q ? [busca] : [])],
  };
}
