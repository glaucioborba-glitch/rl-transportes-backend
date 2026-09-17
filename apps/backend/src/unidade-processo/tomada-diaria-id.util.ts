import { Prisma, StatusUnidadeProcesso } from '@prisma/client';
import { resolveCadastroTabelaVigente } from '../cadastros/cadastro-tabela-preco-vigente';
import { normalizeContainerIso } from '../common/utils/data-sanitize';
import { PrismaService } from '../prisma/prisma.service';
import {
  CODIGO_TOMADA_ABERTURA,
  buildLinhaTomadaDiaria,
  diasTomadaFaturaveis,
  isLancamentoAutomaticoTabela,
} from './servicos-abertura-tabela.util';

type Db = Prisma.TransactionClient | PrismaService;

export async function upsertTomadaDiariaNoProcesso(
  db: Db,
  input: {
    unidadeProcessoId: string;
    clienteId: string;
    tipo?: string | null;
    tamanho?: string | null;
    status?: string | null;
    eventos: Array<{ tipo: 'CONECTADO' | 'DESCONECTADO'; at: Date }>;
    conectada: boolean;
    asOf?: Date;
    userId?: string;
  },
): Promise<void> {
  const asOf = input.asOf ?? new Date();
  const dias = diasTomadaFaturaveis(input.eventos, asOf, input.conectada);
  const existente = await db.unidadeProcessoServico.findFirst({
    where: { unidadeProcessoId: input.unidadeProcessoId, codigo: CODIGO_TOMADA_ABERTURA },
  });
  if (existente && !isLancamentoAutomaticoTabela(existente.payload)) return;

  if (dias < 1) {
    if (existente) {
      await db.unidadeProcessoServico.delete({ where: { id: existente.id } });
    }
    return;
  }

  const tabela = await resolveCadastroTabelaVigente(db, input.clienteId);
  if (!tabela) return;

  const linha = buildLinhaTomadaDiaria({
    itens: tabela.itens,
    tabelaId: tabela.id,
    tipo: input.tipo,
    tamanho: input.tamanho,
    status: input.status,
    dias,
    conectada: input.conectada,
  });
  if (!linha) return;

  const data = {
    codigo: linha.codigo,
    nome: linha.nome,
    quantidade: new Prisma.Decimal(linha.quantidade.toFixed(2)),
    valorUnitario: new Prisma.Decimal(linha.valorUnitario.toFixed(2)),
    valorTotal: new Prisma.Decimal(linha.valorTotal.toFixed(2)),
    lancadoPorUserId: input.userId ?? existente?.lancadoPorUserId ?? null,
    payload: linha.payload as Prisma.InputJsonValue,
  };

  if (existente) {
    await db.unidadeProcessoServico.update({ where: { id: existente.id }, data });
    return;
  }
  await db.unidadeProcessoServico.create({
    data: { unidadeProcessoId: input.unidadeProcessoId, ...data },
  });
}

export async function sincronizarTomadaDiariaDoProcesso(
  db: Db,
  unidadeProcessoId: string,
  opts?: { asOf?: Date; userId?: string },
): Promise<void> {
  const processo = await db.unidadeProcesso.findUnique({
    where: { id: unidadeProcessoId },
    include: {
      entradaSolicitacao: {
        include: { containersSolicitacao: { orderBy: { ordem: 'asc' } } },
      },
    },
  });
  if (!processo || processo.status === StatusUnidadeProcesso.CANCELADO) return;

  const iso = normalizeContainerIso(processo.unidadeIso).replace(/\s/g, '').toUpperCase();
  const form = processo.entradaSolicitacao?.containersSolicitacao.find(
    (c) => normalizeContainerIso(c.unidade).replace(/\s/g, '').toUpperCase() === iso,
  );
  const patio = await db.patioUnidade.findFirst({
    where: {
      unidadeIso: iso,
      OR: [
        { unidadeProcessoId },
        { unidadeProcesso: { status: StatusUnidadeProcesso.ABERTO } },
        { unidadeProcessoId: null, status: { not: 'AGUARDANDO_GATE_OUT' } },
      ],
    },
    include: {
      tomadaEventos: {
        where: { tipo: { in: ['CONECTADO', 'DESCONECTADO'] } },
        orderBy: { createdAt: 'asc' },
        select: { tipo: true, createdAt: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  await upsertTomadaDiariaNoProcesso(db, {
    unidadeProcessoId,
    clienteId: processo.clienteId,
    tipo: form?.tipo,
    tamanho: form?.tamanho,
    status: form?.status,
    eventos: (patio?.tomadaEventos ?? []).map((e) => ({
      tipo: e.tipo as 'CONECTADO' | 'DESCONECTADO',
      at: e.createdAt,
    })),
    conectada: Boolean(patio?.refrigerado),
    asOf: opts?.asOf,
    userId: opts?.userId,
  });
}
