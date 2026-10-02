/**
 * Apaga unidades de pátio/ID e reabre ID só para o que tem RIC e ainda está em estoque.
 * Uso: npx ts-node scripts/resync-estoque-ids.ts
 */
import * as path from 'node:path';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PatioStatus,
  PrismaClient,
  StatusSolicitacao,
  StatusUnidadeProcesso,
} from '@prisma/client';
import { Pool } from 'pg';

config({ path: path.resolve(__dirname, '../../../.env') });

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL não definido (arquivo .env na raiz do monorepo).');

const pool = new Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function normIso(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

async function nextNumero(): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ n: bigint | number }>>`
    SELECT nextval('unidade_processos_numero_seq') AS n
  `;
  return Number(rows[0]?.n ?? 0);
}

async function main() {
  const ricEmEstoque = await prisma.solicitacao.findMany({
    where: {
      deletedAt: null,
      saida: null,
      status: { in: [StatusSolicitacao.EM_PATIO, StatusSolicitacao.AGUARDANDO_GATE_OUT] },
      gate: { ricAssinado: true },
    },
    include: {
      cliente: { select: { id: true, tenantId: true, razaoSocial: true, cpfCnpj: true } },
      containersSolicitacao: { orderBy: { ordem: 'asc' } },
      gateCheckIns: { orderBy: { dataHora: 'desc' }, take: 1 },
      patioUnidadesV2: true,
      patio: { select: { createdAt: true } },
      gate: { select: { createdAt: true, ricAssinado: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  type Snap = {
    iso: string;
    tenantId: string;
    clienteId: string;
    clienteNome: string;
    solicitacaoId: string;
    protocolo: string;
    entradaEm: Date;
    gateInId: string | null;
    refrigerado: boolean;
    statusContainer: 'CHEIO' | 'VAZIO' | 'AMBOS';
    patioStatus: PatioStatus;
  };

  const snaps: Snap[] = [];
  const seenIso = new Set<string>();

  for (const sol of ricEmEstoque) {
    const entradaEm =
      sol.patioUnidadesV2[0]?.createdAt ??
      sol.patio?.createdAt ??
      sol.gate?.createdAt ??
      sol.createdAt;
    for (const c of sol.containersSolicitacao) {
      const iso = normIso(c.unidade);
      if (!iso || seenIso.has(iso)) continue;
      seenIso.add(iso);
      const patio = sol.patioUnidadesV2.find((p) => normIso(p.unidadeIso) === iso);
      snaps.push({
        iso,
        tenantId: sol.cliente.tenantId,
        clienteId: sol.cliente.id,
        clienteNome: `${sol.cliente.razaoSocial} (${sol.cliente.cpfCnpj})`,
        solicitacaoId: sol.id,
        protocolo: sol.protocolo,
        entradaEm,
        gateInId: patio?.gateInId ?? sol.gateCheckIns[0]?.id ?? null,
        refrigerado: patio?.refrigerado ?? c.refrigerado,
        statusContainer:
          patio?.statusContainer === 'VAZIO' || c.status === 'VAZIO' ? 'VAZIO' : 'CHEIO',
        patioStatus: patio?.status ?? PatioStatus.ESTOCADO,
      });
    }
  }

  snaps.sort((a, b) => a.entradaEm.getTime() - b.entradaEm.getTime() || a.iso.localeCompare(b.iso));

  console.log(`Encontradas ${snaps.length} unidade(s) com RIC em estoque. Apagando pátio/IDs…`);

  await prisma.$transaction(async (tx) => {
    await tx.patioTomadaEvent.deleteMany();
    await tx.patioMovimentacao.deleteMany();
    await tx.patioUnidade.deleteMany();
    await tx.preFatura.updateMany({ data: { unidadeProcessoId: null } });
    await tx.unidadeProcesso.deleteMany();
  });

  await prisma.$executeRawUnsafe(`ALTER SEQUENCE unidade_processos_numero_seq RESTART WITH 1`);

  const criadas: string[] = [];
  for (const s of snaps) {
    const numero = await nextNumero();
    const processo = await prisma.unidadeProcesso.create({
      data: {
        tenantId: s.tenantId,
        numero,
        unidadeIso: s.iso,
        clienteId: s.clienteId,
        status: StatusUnidadeProcesso.ABERTO,
        entradaEm: s.entradaEm,
        entradaSolicitacaoId: s.solicitacaoId,
      },
    });
    await prisma.patioUnidade.create({
      data: {
        unidadeIso: s.iso,
        solicitacaoId: s.solicitacaoId,
        gateInId: s.gateInId,
        unidadeProcessoId: processo.id,
        status: s.patioStatus,
        refrigerado: s.refrigerado,
        statusContainer: s.statusContainer,
        createdAt: s.entradaEm,
      },
    });
    criadas.push(`ID ${numero}  ${s.iso}  ${s.protocolo}  ${s.clienteNome}`);
  }

  console.log('Reabertos com ID:');
  for (const line of criadas) console.log(`  ${line}`);
  console.log(`Total: ${criadas.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
