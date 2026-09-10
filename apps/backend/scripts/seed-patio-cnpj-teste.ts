/**
 * Coloca unidades de teste no pátio de um CNPJ (dev).
 * Uso: npx ts-node scripts/seed-patio-cnpj-teste.ts
 */
import * as path from 'node:path';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  Role,
  StatusContainer,
  StatusSolicitacao,
  TipoCaminhao,
  TipoFluxoLogistico,
  TipoOperacaoSolicitacaoIntent,
  TipoUnidade,
  TurnoAgendamento,
  PatioStatus,
} from '@prisma/client';
import { Pool } from 'pg';

config({ path: path.resolve(__dirname, '../../../.env') });

const CNPJ = '27692077000126';
const DEFAULT_TENANT = 'default';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL não definido.');

const pool = new Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const ISO_LETTERS: Record<string, number> = {
  A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20, K: 21, L: 23, M: 24,
  N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31, U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38,
};

function isoCheckDigit(code10: string): string {
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = code10[i].toUpperCase();
    const n = /[A-Z]/.test(ch) ? ISO_LETTERS[ch] : parseInt(ch, 10);
    sum += n * 2 ** i;
  }
  let check = sum % 11;
  if (check === 10) check = 0;
  return String(check);
}

function buildIso(prefix: string, serial: number): string {
  const serial6 = String(serial).padStart(6, '0');
  return `${prefix}${serial6}${isoCheckDigit(prefix + serial6)}`.toUpperCase();
}

const UNIDADES: Array<{
  prefix: string;
  serial: number;
  tipo: string;
  tamanho: string;
  status: StatusContainer;
  refrigerado: boolean;
  setPoint: number | null;
  diasAtras: number;
}> = [
  { prefix: 'MSCU', serial: 882101, tipo: 'DRYDC', tamanho: "20'", status: StatusContainer.CHEIO, refrigerado: false, setPoint: null, diasAtras: 2 },
  { prefix: 'TEMU', serial: 882102, tipo: 'DRYDC', tamanho: "40'", status: StatusContainer.VAZIO, refrigerado: false, setPoint: null, diasAtras: 6 },
  { prefix: 'HLBU', serial: 882103, tipo: 'DRYHC', tamanho: "40'", status: StatusContainer.CHEIO, refrigerado: false, setPoint: null, diasAtras: 9 },
  { prefix: 'CMAU', serial: 882104, tipo: 'REEFER', tamanho: "40'", status: StatusContainer.CHEIO, refrigerado: true, setPoint: -18, diasAtras: 4 },
  { prefix: 'OOLU', serial: 882105, tipo: 'REEFER', tamanho: "20'", status: StatusContainer.CHEIO, refrigerado: true, setPoint: -5, diasAtras: 14 },
  { prefix: 'SEGU', serial: 882106, tipo: 'DRYDC', tamanho: "20'", status: StatusContainer.VAZIO, refrigerado: false, setPoint: null, diasAtras: 21 },
  { prefix: 'FCIU', serial: 882107, tipo: 'DRYHC', tamanho: "40'", status: StatusContainer.CHEIO, refrigerado: false, setPoint: null, diasAtras: 1 },
  { prefix: 'TXGU', serial: 882108, tipo: 'OPENTOP', tamanho: "40'", status: StatusContainer.CHEIO, refrigerado: false, setPoint: null, diasAtras: 11 },
];

async function main() {
  const cliente = await prisma.cliente.findFirst({
    where: { deletedAt: null, cpfCnpj: { in: [CNPJ, '27.692.077/0001-26'] } },
    select: { id: true, razaoSocial: true, nomeFantasia: true, cpfCnpj: true, tenantId: true },
  });
  if (!cliente) {
    throw new Error(`Cliente ${CNPJ} não encontrado. Cadastre no portal ou na intranet antes.`);
  }

  const operador = await prisma.user.findFirst({
    where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN, Role.OPERADOR_GATE] } },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!operador) throw new Error('Nenhum usuário staff para amarrar o gate-in.');

  const stamp = Date.now().toString().slice(-6);
  const criadas: string[] = [];

  for (let i = 0; i < UNIDADES.length; i++) {
    const u = UNIDADES[i];
    const iso = buildIso(u.prefix, u.serial);
    const entrada = new Date();
    entrada.setUTCDate(entrada.getUTCDate() - u.diasAtras);
    entrada.setUTCHours(10 + (i % 6), 15, 0, 0);

    const jaAberta = await prisma.unidadeProcesso.findFirst({
      where: { unidadeIso: iso, status: 'ABERTO' },
      select: { numero: true },
    });
    if (jaAberta) {
      console.log(`  skip ${iso} — já tem ID ${jaAberta.numero} aberto`);
      continue;
    }

    const protocolo = `TST-SIM-${stamp}-${String(i + 1).padStart(2, '0')}`;

    const sol = await prisma.solicitacao.create({
      data: {
        tenantId: cliente.tenantId,
        protocolo,
        clienteId: cliente.id,
        status: StatusSolicitacao.EM_PATIO,
        tipoOperacao: TipoOperacaoSolicitacaoIntent.SOLICITAR_IMPORTACAO_COLETA_DEPOT,
        tipoFluxo: TipoFluxoLogistico.IMPORTACAO,
        createdAt: entrada,
        transporteSolicitacao: {
          create: {
            nomeMotorista: 'Motorista Teste Simulação',
            cpfMotorista: '39053344705',
            tipoCaminhao: TipoCaminhao.LS,
            placaCavalo: `TST1A${i}${i}`,
            placaCarreta01: `TST2B${i}${i}`,
          },
        },
        containersSolicitacao: {
          create: {
            unidade: iso,
            booking: `BK-SIM-${i + 1}`,
            processo: `PROC-SIM-${i + 1}`,
            tamanho: u.tamanho,
            tipo: u.tipo,
            status: u.status,
            lacre: u.status === StatusContainer.CHEIO ? `LCR${88000 + i}` : '',
            refrigerado: u.refrigerado,
            setPoint: u.setPoint,
            ordem: 1,
          },
        },
        agendamentoSolicitacao: {
          create: {
            dataRef: entrada,
            turno: i % 2 === 0 ? TurnoAgendamento.MANHA : TurnoAgendamento.TARDE,
          },
        },
        solicitanteContato: {
          create: {
            nome: 'Teste Simulação',
            telefone: '47999990000',
            email: 'teste.simulacao@rl.local',
          },
        },
        unidades: {
          create: {
            numeroIso: iso,
            tipo: TipoUnidade.IMPORT,
          },
        },
        portaria: {
          create: {
            placaVeiculo: `TST1A${i}${i}`,
            motoristaNome: 'Motorista Teste Simulação',
            motoristaCpf: '39053344705',
            transportadoraNome: 'Transportadora Teste',
            statusOcr: 'validado',
            createdAt: entrada,
          },
        },
        gate: { create: { ricAssinado: true, createdAt: entrada } },
        patio: {
          create: {
            quadra: `TS${stamp.slice(-2)}`,
            fileira: `F${String(i + 1).padStart(2, '0')}`,
            posicao: `P${String(i + 1).padStart(2, '0')}`,
            createdAt: entrada,
          },
        },
      },
    });

    const gateIn = await prisma.gateCheckIn.create({
      data: {
        tenantId: cliente.tenantId,
        solicitacaoId: sol.id,
        operadorId: operador.id,
        dataHora: entrada,
        placaCavalo: `TST1A${i}${i}`,
        placaCarreta01: `TST2B${i}${i}`,
        motoristaNome: 'Motorista Teste Simulação',
        motoristaCpf: '39053344705',
        fotosEntrada: [{ url: 'local://teste/gate-in.jpg', label: 'Entrada' }],
      },
    });

    const [{ n }] = await prisma.$queryRaw<Array<{ n: bigint | number }>>`
      SELECT nextval('unidade_processos_numero_seq') AS n
    `;
    const processo = await prisma.unidadeProcesso.create({
      data: {
        tenantId: cliente.tenantId,
        numero: Number(n),
        unidadeIso: iso,
        clienteId: cliente.id,
        status: 'ABERTO',
        entradaEm: entrada,
        entradaSolicitacaoId: sol.id,
      },
    });

    await prisma.patioUnidade.create({
      data: {
        unidadeIso: iso,
        solicitacaoId: sol.id,
        gateInId: gateIn.id,
        unidadeProcessoId: processo.id,
        status: PatioStatus.ESTOCADO,
        refrigerado: u.refrigerado,
        statusContainer: u.status === StatusContainer.VAZIO ? 'VAZIO' : 'CHEIO',
        createdAt: entrada,
      },
    });

    criadas.push(
      `ID ${Number(n)}  ${iso}  ${u.tipo.padEnd(8)} ${u.tamanho.padEnd(4)} ${u.status.padEnd(5)}  entrada ${entrada.toISOString().slice(0, 10)} (${u.diasAtras}d)`,
    );
  }

  console.log(`Cliente: ${cliente.razaoSocial} (${cliente.cpfCnpj})`);
  console.log(`Unidades no pátio:`);
  for (const line of criadas) console.log(`  ${line}`);
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
