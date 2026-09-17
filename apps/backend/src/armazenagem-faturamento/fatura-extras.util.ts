import { EventoGatilhoTarifa, Prisma, StatusFrete } from '@prisma/client';
import { pairLocaisTransporte, valorCobradoTransporte } from '../cadastros/local-transporte-pair.util';
import { PrismaService } from '../prisma/prisma.service';
import { isLancamentoAutomaticoTabela } from '../unidade-processo/servicos-abertura-tabela.util';
import { roundMoney, toDecimal } from './armazenagem-billing.util';

type Db = Prisma.TransactionClient | PrismaService;

export async function syncExtrasOnPreFatura(
  db: Db,
  input: {
    preFaturaId: string;
    unidadeProcessoId?: string | null;
    clienteId: string;
    tenantId: string;
    containerIso: string;
  },
): Promise<void> {
  await db.itemFaturaArmazenagem.deleteMany({
    where: {
      preFaturaId: input.preFaturaId,
      eventoGatilho: { in: [EventoGatilhoTarifa.SERVICO_ADICIONAL, EventoGatilhoTarifa.FRETE] },
    },
  });

  const linhas: Prisma.ItemFaturaArmazenagemCreateManyInput[] = [];

  if (input.unidadeProcessoId) {
    const servicos = await db.unidadeProcessoServico.findMany({
      where: { unidadeProcessoId: input.unidadeProcessoId },
    });
    for (const s of servicos) {
      if (isLancamentoAutomaticoTabela(s.payload)) continue;
      const qtd = Number(s.quantidade);
      linhas.push({
        preFaturaId: input.preFaturaId,
        eventoGatilho: EventoGatilhoTarifa.SERVICO_ADICIONAL,
        descricao: `${s.nome} (${s.codigo})`,
        quantidade: Math.max(1, Math.round(qtd)),
        valorUnitario: toDecimal(Number(s.valorUnitario)),
        valorTotal: toDecimal(Number(s.valorTotal)),
      });
    }
  }

  const frete = await resolveFreteDaFatura(db, input);
  if (frete) {
    linhas.push({
      preFaturaId: input.preFaturaId,
      eventoGatilho: EventoGatilhoTarifa.FRETE,
      descricao: frete.descricao,
      quantidade: 1,
      valorUnitario: toDecimal(frete.valor),
      valorTotal: toDecimal(frete.valor),
    });
  }

  if (linhas.length) {
    await db.itemFaturaArmazenagem.createMany({ data: linhas });
  }
}

async function resolveFreteDaFatura(
  db: Db,
  input: { unidadeProcessoId?: string | null; clienteId: string; tenantId: string; containerIso: string },
): Promise<{ valor: number; descricao: string } | null> {
  const doQuadro = await db.frete.findFirst({
    where: {
      tenantId: input.tenantId,
      numeroIso: input.containerIso,
      status: { not: StatusFrete.CANCELADO },
      OR: [{ clienteId: input.clienteId }, { clienteId: null }],
    },
    orderBy: { createdAt: 'desc' },
  });
  if (doQuadro?.valor != null && Number(doQuadro.valor) > 0) {
    return {
      valor: roundMoney(Number(doQuadro.valor)),
      descricao: `Frete ${doQuadro.tipo}${doQuadro.local ? ` — ${doQuadro.local}` : ''}`,
    };
  }

  const processo = input.unidadeProcessoId
    ? await db.unidadeProcesso.findUnique({
        where: { id: input.unidadeProcessoId },
        include: {
          entradaSolicitacao: {
            select: {
              agendamentos: {
                select: { localOrigem: true, localDestino: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      })
    : null;

  const ag = processo?.entradaSolicitacao?.agendamentos[0];
  const origemNome = ag?.localOrigem ?? doQuadro?.local ?? null;
  const destinoNome = ag?.localDestino ?? null;
  if (!origemNome || !destinoNome) return null;

  const cliente = await db.cliente.findUnique({
    where: { id: input.clienteId },
    select: { cadastroTabelaTransporteId: true },
  });
  const tabelaId =
    cliente?.cadastroTabelaTransporteId ??
    (
      await db.cadastroTabelaTransporte.findFirst({
        where: { tenantId: input.tenantId, deletedAt: null, ativo: true, padrao: true },
        select: { id: true },
      })
    )?.id;
  if (!tabelaId) return null;

  const locais = await db.cadastroLocalTransporte.findMany({
    where: {
      tenantId: input.tenantId,
      deletedAt: null,
      ativo: true,
      OR: [
        { nome: { equals: origemNome, mode: 'insensitive' } },
        { nome: { equals: destinoNome, mode: 'insensitive' } },
        { codigo: { equals: origemNome, mode: 'insensitive' } },
        { codigo: { equals: destinoNome, mode: 'insensitive' } },
      ],
    },
    select: { id: true, nome: true, codigo: true },
  });
  const origem = locais.find((l) => eqNome(l.nome, origemNome) || eqNome(l.codigo, origemNome));
  const destino = locais.find((l) => eqNome(l.nome, destinoNome) || eqNome(l.codigo, destinoNome));
  if (!origem || !destino) return null;

  const pair = pairLocaisTransporte(origem.id, destino.id);
  const statusCarga = doQuadro?.statusCarga ?? 'CHEIO';
  const tarifa = await db.cadastroTarifaTransporte.findFirst({
    where: {
      tabelaId,
      localAId: pair.localAId,
      localBId: pair.localBId,
      statusCarga,
      deletedAt: null,
      ativo: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!tarifa) return null;
  const valor = valorCobradoTransporte(Number(tarifa.valor), tarifa.retorno);
  if (valor <= 0) return null;
  return { valor, descricao: `Frete ${origem.nome} × ${destino.nome}` };
}

function eqNome(a: string, b: string) {
  return a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR');
}
