import { Prisma } from '@prisma/client';
import { formatUnidadeProcessoId } from '../unidade-processo/unidade-direcao.util';

export const SOLICITACOES_PROTOCOLO_SEQ = 'solicitacoes_protocolo_seq';

export function formatProtocoloNumero(n: number): string {
  return String(n);
}

export function parseProtocoloNumero(protocolo: string | null | undefined): number | null {
  const v = protocolo?.trim() ?? '';
  if (!/^\d+$/.test(v)) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export async function nextProtocoloSolicitacao(
  db: Pick<Prisma.TransactionClient, '$queryRaw'>,
): Promise<string> {
  const rows = await db.$queryRaw<Array<{ n: bigint | number }>>`
    SELECT nextval('solicitacoes_protocolo_seq') AS n
  `;
  return formatProtocoloNumero(Number(rows[0]?.n ?? 0));
}

export function numeroIdDaSolicitacao(sol: {
  unidadeProcessosEntrada?: Array<{ numero: number }> | null;
  unidadeProcessosSaida?: Array<{ numero: number }> | null;
}): number | null {
  const n = sol.unidadeProcessosEntrada?.[0]?.numero ?? sol.unidadeProcessosSaida?.[0]?.numero;
  return n != null && Number.isFinite(n) && n > 0 ? n : null;
}

/** ID operacional é o controle principal depois de criado; protocolo fica secundário. */
export function rotuloControleOperacao(input: {
  unidadeProcessoNumero?: number | null;
  protocolo?: string | null;
}): { primario: string; secundario?: string } {
  const id = input.unidadeProcessoNumero;
  const proto = input.protocolo?.trim();
  if (id != null && Number.isFinite(id) && id > 0) {
    return {
      primario: formatUnidadeProcessoId(id),
      ...(proto ? { secundario: `Protocolo ${proto}` } : {}),
    };
  }
  return { primario: proto ? `Protocolo ${proto}` : '—' };
}

export function rotuloAuditoriaControle(input: {
  unidadeProcessoNumero?: number | null;
  protocolo?: string | null;
}): string {
  const { primario, secundario } = rotuloControleOperacao(input);
  return secundario ? `${primario} (${secundario})` : primario;
}

export const SOLICITACAO_CONTROLE_INCLUDE = {
  unidadeProcessosEntrada: {
    select: { id: true, numero: true, status: true, entradaEm: true },
    orderBy: { numero: 'asc' as const },
  },
  unidadeProcessosSaida: {
    select: { id: true, numero: true, status: true },
    orderBy: { numero: 'asc' as const },
  },
};

/** Busca por protocolo sequencial (exato) ou ID operacional; texto livre ainda usa contém. */
export function protocoloBuscaWhere(raw: string): Prisma.SolicitacaoWhereInput | null {
  const proto = raw.trim().replace(/^#/, '');
  if (!proto) return null;
  const n = parseProtocoloNumero(proto);
  if (n != null) {
    return {
      OR: [
        { protocolo: proto },
        { protocolo: { contains: proto, mode: 'insensitive' } },
        { unidadeProcessosEntrada: { some: { numero: n } } },
        { unidadeProcessosSaida: { some: { numero: n } } },
      ],
    };
  }
  return { protocolo: { contains: proto, mode: 'insensitive' } };
}
