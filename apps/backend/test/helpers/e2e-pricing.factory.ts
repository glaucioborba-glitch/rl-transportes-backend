import { PrismaClient } from '@prisma/client';
import {
  EventoGatilhoTarifa,
  Prisma,
  StatusContainerTarifa,
  TipoContainerTarifa,
} from '@prisma/client';
import { FAIXAS_DIARIA_PADRAO } from '../src/billing-engine/faixa-diaria-calculator';
import {
  DEFAULT_VALOR_DIARIA,
  DEFAULT_VALOR_SERVICOS_EXTRAS,
} from '../src/armazenagem-faturamento/armazenagem-billing.util';

/** Cria tabela de preços billing para testes E2E (substitui TabelaTarifaria). */
export async function ensureE2ePricingTable(
  prisma: PrismaClient,
  opts?: {
    clienteId?: string;
    freeTimeDias?: number;
    valorDiaria?: number;
    valorServicosExtras?: number;
  },
): Promise<string> {
  const freeTime = opts?.freeTimeDias ?? 0;
  const valorDiaria = opts?.valorDiaria ?? DEFAULT_VALOR_DIARIA;
  const extras = opts?.valorServicosExtras ?? DEFAULT_VALOR_SERVICOS_EXTRAS;

  const tabela = await prisma.tabelaPreco.create({
    data: {
      tenantId: 'default',
      nome: `E2E Pricing ${Date.now()}`,
      ativa: true,
      padrao: false,
      regras: {
        create: [
          {
            nome: 'E2E Diária',
            eventoGatilho: EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
            tipoContainer: TipoContainerTarifa.TODOS,
            statusContainer: StatusContainerTarifa.AMBOS,
            valor: new Prisma.Decimal(valorDiaria.toFixed(2)),
            diasFreeTime: freeTime,
            faixasDiaria: freeTime > 0
              ? (FAIXAS_DIARIA_PADRAO as unknown as Prisma.InputJsonValue)
              : ([{ diaInicio: 1, diaFim: null, valorDiaria }] as unknown as Prisma.InputJsonValue),
            ativa: true,
          },
          {
            nome: 'E2E Handling',
            eventoGatilho: EventoGatilhoTarifa.HANDLING,
            tipoContainer: TipoContainerTarifa.TODOS,
            statusContainer: StatusContainerTarifa.AMBOS,
            valor: new Prisma.Decimal('0'),
            diasFreeTime: 0,
            ativa: true,
          },
          ...(extras > 0
            ? [
                {
                  nome: 'E2E Shifting',
                  eventoGatilho: EventoGatilhoTarifa.SHIFTING_EXTRA,
                  tipoContainer: TipoContainerTarifa.TODOS,
                  statusContainer: StatusContainerTarifa.AMBOS,
                  valor: new Prisma.Decimal(extras.toFixed(2)),
                  diasFreeTime: 0,
                  ativa: true,
                },
              ]
            : []),
        ],
      },
    },
  });

  if (opts?.clienteId) {
    await prisma.cliente.update({
      where: { id: opts.clienteId },
      data: { tabelaPrecoId: tabela.id },
    });
  }

  return tabela.id;
}
