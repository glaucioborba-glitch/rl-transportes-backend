/**
 * Migra TabelaTarifaria legada → TabelaPreco + RegraTarifaria por cliente.
 * Uso: npx ts-node scripts/migrate-tabela-tarifaria-to-regras.ts
 */
import * as path from 'node:path';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  EventoGatilhoTarifa,
  Prisma,
  PrismaClient,
  StatusContainerTarifa,
  TipoContainerTarifa,
} from '@prisma/client';
import { Pool } from 'pg';

config({ path: path.resolve(__dirname, '../../../.env') });

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL não definido.');

const pool = new Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const legados = await prisma.tabelaTarifaria.findMany({
    include: { cliente: { select: { id: true, razaoSocial: true, tenantId: true, tabelaPrecoId: true } } },
  });

  if (!legados.length) {
    console.log('Nenhuma TabelaTarifaria legada encontrada.');
    return;
  }

  let migrated = 0;
  for (const leg of legados) {
    if (leg.cliente.tabelaPrecoId) {
      console.log(`Cliente ${leg.cliente.razaoSocial} já tem tabelaPrecoId — skip.`);
      continue;
    }

    const tabela = await prisma.tabelaPreco.create({
      data: {
        tenantId: leg.cliente.tenantId,
        nome: `Migrado — ${leg.cliente.razaoSocial}`,
        ativa: true,
        padrao: false,
        regras: {
          create: [
            {
              nome: 'Diária migrada',
              eventoGatilho: EventoGatilhoTarifa.DIARIA_ARMAZENAGEM,
              tipoContainer: TipoContainerTarifa.TODOS,
              statusContainer: StatusContainerTarifa.AMBOS,
              valor: leg.valorDiaria,
              diasFreeTime: leg.freeTimeDias,
              faixasDiaria: [
                {
                  diaInicio: leg.freeTimeDias + 1,
                  diaFim: null,
                  valorDiaria: Number(leg.valorDiaria),
                },
              ] as unknown as Prisma.InputJsonValue,
              ativa: true,
            },
            ...(Number(leg.valorServicosExtras) > 0
              ? [
                  {
                    nome: 'Serviços extras migrados',
                    eventoGatilho: EventoGatilhoTarifa.SHIFTING_EXTRA,
                    tipoContainer: TipoContainerTarifa.TODOS,
                    statusContainer: StatusContainerTarifa.AMBOS,
                    valor: leg.valorServicosExtras,
                    diasFreeTime: 0,
                    ativa: true,
                  },
                ]
              : []),
          ],
        },
      },
    });

    await prisma.cliente.update({
      where: { id: leg.clienteId },
      data: { tabelaPrecoId: tabela.id },
    });

    migrated++;
    console.log(`Migrado cliente ${leg.cliente.razaoSocial} → tabela ${tabela.id}`);
  }

  console.log(`\nConcluído: ${migrated}/${legados.length} clientes migrados.`);
  console.log('TabelaTarifaria mantida read-only; remova manualmente após validação.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
