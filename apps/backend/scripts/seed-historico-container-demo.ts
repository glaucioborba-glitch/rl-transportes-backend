/**
 * Seed de demonstração: um contêiner com múltiplas passagens (entrada/saída)
 * para testar a tela Histórico de Contêiner no Gate CPO.
 *
 * Uso:
 *   cd apps/backend
 *   npx ts-node scripts/seed-historico-container-demo.ts
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
  TurnoAgendamento,
  PatioStatus,
} from '@prisma/client';
import { Pool } from 'pg';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ContainerValidator = require('container-validator') as new () => { isValid: (code: string) => boolean };

config({ path: path.resolve(__dirname, '../../../.env') });

const DEFAULT_TENANT = 'default';
const PROTOCOL_PREFIX = 'HIST-ISO-';

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
  const iso = `${prefix}${serial6}${isoCheckDigit(prefix + serial6)}`.toUpperCase();
  const validator = new ContainerValidator();
  if (!validator.isValid(iso)) throw new Error(`ISO inválido: ${iso}`);
  return iso;
}

/** Contêiner fixo para busca na UI (exemplo da tela: MSCU 100113-7). */
const CONTAINER_ISO = buildIso('MSCU', 100113);

type PassagemDemo = {
  seq: number;
  statusCarga: StatusContainer;
  entrada: Date;
  saida: Date | null;
  motorista: string;
  cpf: string;
  placa: string;
  empresa: string;
};

const PASSAGENS: PassagemDemo[] = [
  {
    seq: 1,
    statusCarga: StatusContainer.CHEIO,
    entrada: new Date('2026-01-15T08:30:00.000Z'),
    saida: new Date('2026-01-18T16:45:00.000Z'),
    motorista: 'João da Silva',
    cpf: '12345678901',
    placa: 'QAB1C23',
    empresa: 'Atlântico Logística Importadora LTDA',
  },
  {
    seq: 2,
    statusCarga: StatusContainer.VAZIO,
    entrada: new Date('2026-02-10T09:15:00.000Z'),
    saida: new Date('2026-02-12T14:20:00.000Z'),
    motorista: 'Maria Oliveira',
    cpf: '98765432100',
    placa: 'RXY2D45',
    empresa: 'Brasil Cargo Exportação EIRELI',
  },
  {
    seq: 3,
    statusCarga: StatusContainer.CHEIO,
    entrada: new Date('2026-03-05T07:00:00.000Z'),
    saida: new Date('2026-03-08T18:10:00.000Z'),
    motorista: 'Pedro Santos',
    cpf: '45678912300',
    placa: 'SCZ3E67',
    empresa: 'Costa Sul Armazéns Gerais LTDA',
  },
  {
    seq: 4,
    statusCarga: StatusContainer.VAZIO,
    entrada: new Date('2026-04-20T10:40:00.000Z'),
    saida: null,
    motorista: 'Ana Costa',
    cpf: '32165498700',
    placa: 'TUV4F89',
    empresa: 'Depot Container Services LTDA',
  },
  {
    seq: 5,
    statusCarga: StatusContainer.CHEIO,
    entrada: new Date('2026-05-01T06:55:00.000Z'),
    saida: new Date('2026-05-03T11:30:00.000Z'),
    motorista: 'Roberto Campos',
    cpf: '78912345600',
    placa: 'UVW5G12',
    empresa: 'Expresso Portuário SC LTDA',
  },
];

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL não definido.');

const pool = new Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function ensureOperadorId(): Promise<string> {
  const user =
    (await prisma.user.findFirst({ where: { role: Role.OPERADOR_GATE } })) ??
    (await prisma.user.findFirst({ where: { role: Role.ADMIN } }));
  if (!user) throw new Error('Nenhum operador/admin encontrado. Rode o seed base primeiro.');
  return user.id;
}

async function ensureClienteIds(count: number): Promise<string[]> {
  const clientes = await prisma.cliente.findMany({
    orderBy: { createdAt: 'asc' },
    take: count,
    select: { id: true },
  });
  if (clientes.length === 0) throw new Error('Nenhum cliente encontrado. Rode o seed base primeiro.');
  const ids = clientes.map((c) => c.id);
  while (ids.length < count) ids.push(ids[ids.length % clientes.length]);
  return ids.slice(0, count);
}

async function ensurePatioBaia(codigo: string) {
  return prisma.patioPosicao.upsert({
    where: { codigoBaia: codigo },
    create: { codigoBaia: codigo, comprimento: 12, largura: 3, capacidade: 2 },
    update: {},
  });
}

async function cleanupHistoricoDemo() {
  const olds = await prisma.solicitacao.findMany({
    where: { protocolo: { startsWith: PROTOCOL_PREFIX } },
    select: { id: true },
  });
  for (const s of olds) {
    await prisma.solicitacao.delete({ where: { id: s.id } });
  }
  await prisma.cadastroContainerCache.deleteMany({ where: { numeroIso: CONTAINER_ISO } });
}

async function createPassagem(
  passagem: PassagemDemo,
  clienteId: string,
  operadorId: string,
  baiaId: string,
) {
  const protocolo = `${PROTOCOL_PREFIX}${String(passagem.seq).padStart(3, '0')}`;
  const concluido = passagem.saida !== null;
  const statusSol = concluido
    ? StatusSolicitacao.CONCLUIDO
    : StatusSolicitacao.EM_PATIO;

  const sol = await prisma.solicitacao.create({
    data: {
      tenantId: DEFAULT_TENANT,
      protocolo,
      clienteId,
      status: statusSol,
      tipoOperacao: TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA,
      tipoFluxo: TipoFluxoLogistico.COLETA_CONTAINER,
      transporteSolicitacao: {
        create: {
          nomeMotorista: passagem.motorista,
          cpfMotorista: passagem.cpf,
          tipoCaminhao: TipoCaminhao.LS,
          placaCavalo: passagem.placa,
          placaCarreta01: passagem.placa,
        },
      },
      containersSolicitacao: {
        create: {
          unidade: CONTAINER_ISO,
          booking: `BK-HIST-${passagem.seq}`,
          processo: `PROC-HIST-${passagem.seq}`,
          tamanho: passagem.seq % 2 === 0 ? '40HC' : '20DC',
          tipo: passagem.statusCarga === StatusContainer.CHEIO ? 'DRY' : 'HC',
          status: passagem.statusCarga,
          lacre: passagem.statusCarga === StatusContainer.CHEIO ? `LCR${9000 + passagem.seq}` : null,
          ordem: 1,
        },
      },
      agendamentoSolicitacao: {
        create: {
          dataRef: new Date(passagem.entrada.toISOString().slice(0, 10) + 'T12:00:00.000Z'),
          turno: TurnoAgendamento.MANHA,
        },
      },
      solicitanteContato: {
        create: {
          nome: passagem.motorista,
          telefone: '47999990000',
          email: `hist.demo.${passagem.seq}@rl.demo.test`,
        },
      },
    },
  });

  await prisma.portaria.create({
    data: {
      solicitacaoId: sol.id,
      placaVeiculo: passagem.placa,
      motoristaNome: passagem.motorista,
      motoristaCpf: passagem.cpf,
      transportadoraNome: passagem.empresa,
      motoristaTelefone: '47999990000',
      statusOcr: 'validado',
    },
  });

  await prisma.gate.create({ data: { solicitacaoId: sol.id, ricAssinado: true } });

  await prisma.patio.create({
    data: {
      solicitacaoId: sol.id,
      quadra: `HI${String(passagem.seq).padStart(2, '0')}`,
      fileira: `HF${String(passagem.seq).padStart(2, '0')}`,
      posicao: `HP${String(passagem.seq).padStart(2, '0')}`,
    },
  });

  const gateIn = await prisma.gateCheckIn.create({
    data: {
      tenantId: DEFAULT_TENANT,
      solicitacaoId: sol.id,
      operadorId,
      dataHora: passagem.entrada,
      placaCavalo: passagem.placa,
      placaCarreta01: passagem.placa,
      motoristaNome: passagem.motorista,
      motoristaCpf: passagem.cpf,
      fotosEntrada: [{ url: 'local://demo/hist-in.jpg', label: 'Entrada' }],
    },
  });

  await prisma.patioUnidade.create({
    data: {
      unidadeIso: CONTAINER_ISO,
      solicitacaoId: sol.id,
      gateInId: gateIn.id,
      posicaoAtualId: baiaId,
      status: concluido ? PatioStatus.SEPARADO : PatioStatus.ESTOCADO,
      refrigerado: false,
      createdAt: passagem.entrada,
    },
  });

  if (passagem.saida) {
    await prisma.gateCheckOut.create({
      data: {
        gateInId: gateIn.id,
        operadorId,
        dataHora: passagem.saida,
        fotosSaida: [{ url: 'local://demo/hist-out.jpg', label: 'Saída' }],
      },
    });
    await prisma.saida.create({
      data: {
        solicitacaoId: sol.id,
        dataHoraSaida: passagem.saida,
      },
    });
  }

  return protocolo;
}

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_SEED !== '1') {
    console.error('[hist-seed] Bloqueado em produção.');
    process.exit(1);
  }

  console.log(`[hist-seed] Contêiner: ${CONTAINER_ISO} (${CONTAINER_ISO.slice(0, 4)} ${CONTAINER_ISO.slice(4, 10)}-${CONTAINER_ISO.slice(10)})`);
  console.log('[hist-seed] Limpando passagens demo anteriores…');
  await cleanupHistoricoDemo();

  const operadorId = await ensureOperadorId();
  const clienteIds = await ensureClienteIds(PASSAGENS.length);
  const baia = await ensurePatioBaia('H01');

  const protocolos: string[] = [];
  for (const [i, p] of PASSAGENS.entries()) {
    const proto = await createPassagem(p, clienteIds[i], operadorId, baia.id);
    protocolos.push(proto);
    console.log(
      `[hist-seed] #${p.seq} ${proto} — ${p.statusCarga} | entrada ${p.entrada.toISOString().slice(0, 16)} | saída ${p.saida ? p.saida.toISOString().slice(0, 16) : 'PENDENTE'}`,
    );
  }

  await prisma.cadastroContainerCache.create({
    data: {
      numeroIso: CONTAINER_ISO,
      tipo: 'DRY',
      tamanho: '20DC',
      primeiraPassagem: PASSAGENS[0].entrada,
    },
  });

  console.log('');
  console.log('[hist-seed] Concluído!');
  console.log(`  Buscar na tela: ${CONTAINER_ISO.slice(0, 4)} ${CONTAINER_ISO.slice(4, 10)}-${CONTAINER_ISO.slice(10)}`);
  console.log(`  URL: http://localhost:3000/operador/gate/historico-container`);
  console.log(`  Passagens: ${protocolos.length} (4 com saída, 1 aguardando saída)`);
  console.log('  Status alternados: CHEIO → VAZIO → CHEIO → VAZIO (sem saída) → CHEIO');
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
