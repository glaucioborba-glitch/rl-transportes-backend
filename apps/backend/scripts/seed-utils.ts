/**
 * Utilitários compartilhados pelos scripts de seed do RL Terminal.
 */
import * as path from 'node:path';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient, Role } from '@prisma/client';
import { Pool } from 'pg';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ContainerValidator = require('container-validator') as new () => { isValid: (code: string) => boolean };

config({ path: path.resolve(__dirname, '../../../.env') });

export const DEFAULT_TENANT = 'default';
export const SEED_EMAIL_DOMAIN = '@rl.seed.test';
export const SEED_CLIENT_PASSWORD = 'Cliente@123';
export const SEED_TERMOS_VERSAO = 'v1.0-2026';
export const BCRYPT_ROUNDS = 12;

export const SEED_PROTOCOL = {
  portal: 'SEED-PORT',
  gateAuth: 'SEED-GATE-AUTH',
  gateOp: 'SEED-GATE-OP',
  gateDsp: 'SEED-GATE-DSP',
  gateHist: 'SEED-GATE-HIST',
} as const;

const ISO_LETTERS: Record<string, number> = {
  A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20, K: 21, L: 23, M: 24,
  N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31, U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38,
};

let pool: Pool | null = null;
let prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (prisma) return prisma;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não definido (carregue o .env da raiz do monorepo).');
  pool = new Pool({ connectionString: url });
  prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) await prisma.$disconnect();
  if (pool) await pool.end();
  prisma = null;
  pool = null;
}

export function gerarCnpj(root12: string): string {
  let tamanho = 12;
  let numeros = root12.substring(0, tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  let d1 = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  tamanho = 13;
  numeros = root12.substring(0, 12) + String(d1);
  soma = 0;
  pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  const d2 = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  return root12.substring(0, 12) + String(d1) + String(d2);
}

export function gerarCpf(base9: string): string {
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(base9[i], 10) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  const d1 = String(resto);
  soma = 0;
  const cpf10 = base9 + d1;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf10[i], 10) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  return base9 + d1 + String(resto);
}

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

export function buildIso(prefix: string, serial: number): string {
  const serial6 = String(serial).padStart(6, '0');
  const iso = `${prefix}${serial6}${isoCheckDigit(prefix + serial6)}`.toUpperCase();
  const validator = new ContainerValidator();
  if (!validator.isValid(iso)) throw new Error(`ISO inválido gerado: ${iso}`);
  return iso;
}

export const SEED_CONTAINERS = [
  { numero: buildIso('MSCU', 100113), tipo: 'DRY', tamanho: '20DC', situacao: 'CHEIO' as const },
  { numero: buildIso('FCIU', 100112), tipo: 'REEFER', tamanho: '40HC', situacao: 'CHEIO' as const },
  { numero: buildIso('YMLU', 900302), tipo: 'HC', tamanho: '40HC', situacao: 'CHEIO' as const },
  { numero: buildIso('CMAU', 100124), tipo: 'DRY', tamanho: '20DC', situacao: 'VAZIO' as const },
  { numero: buildIso('SEGU', 100135), tipo: 'DRY', tamanho: '20DC', situacao: 'CHEIO' as const },
  { numero: buildIso('TXGU', 100134), tipo: 'HC', tamanho: '40HC', situacao: 'CHEIO' as const },
  { numero: buildIso('OOLU', 100133), tipo: 'REEFER', tamanho: '40HC', situacao: 'VAZIO' as const },
  { numero: buildIso('HLBU', 100139), tipo: 'DRY', tamanho: '40HC', situacao: 'CHEIO' as const },
  { numero: buildIso('TEMU', 100138), tipo: 'HC', tamanho: '40HC', situacao: 'CHEIO' as const },
  { numero: buildIso('MSCU', 100137), tipo: 'DRY', tamanho: '20DC', situacao: 'CHEIO' as const },
];

export type SeedCadastrosIds = {
  tiposContainer: string[];
  colaboradores: string[];
  transportadoras: string[];
  motoristas: string[];
  equipamentos: string[];
};

export type SeedPortalIds = {
  clientes: Array<{ id: string; cnpj: string; razaoSocial: string; cpfPessoa: string; email: string }>;
};

export async function ensureTenant(): Promise<void> {
  const p = getPrisma();
  await p.tenant.upsert({
    where: { id: DEFAULT_TENANT },
    create: { id: DEFAULT_TENANT, slug: 'default', nome: 'RL Transportes' },
    update: {},
  });
}

export async function ensureOperadorGateId(): Promise<string> {
  const p = getPrisma();
  const user =
    (await p.user.findFirst({ where: { role: Role.OPERADOR_GATE, tenantId: DEFAULT_TENANT } })) ??
    (await p.user.findFirst({ where: { role: Role.ADMIN, tenantId: DEFAULT_TENANT } }));
  if (!user) throw new Error('Operador gate não encontrado — rode `npx prisma db seed` primeiro.');
  return user.id;
}

export async function ensureOperadorPortariaId(): Promise<string> {
  const p = getPrisma();
  const user = await p.user.findFirst({
    where: { role: Role.OPERADOR_PORTARIA, tenantId: DEFAULT_TENANT },
    select: { id: true },
  });
  if (!user) throw new Error('Operador portaria não encontrado — rode `npx prisma db seed` primeiro.');
  return user.id;
}

export async function ensurePatioBaia(codigo: string) {
  return getPrisma().patioPosicao.findUniqueOrThrow({ where: { codigoBaia: codigo } });
}

export async function findSeedClientes(): Promise<SeedPortalIds> {
  const rows = await getPrisma().cliente.findMany({
    where: { email: { endsWith: SEED_EMAIL_DOMAIN } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, cpfCnpj: true, razaoSocial: true, email: true },
  });
  if (rows.length === 0) return { clientes: [] };

  const pessoas = await getPrisma().pessoaAutorizada.findMany({
    where: { clienteId: { in: rows.map((r) => r.id) } },
    select: { clienteId: true, cpf: true },
  });
  const cpfByCliente = new Map(pessoas.map((p) => [p.clienteId, p.cpf]));

  return {
    clientes: rows.map((r) => ({
      id: r.id,
      cnpj: r.cpfCnpj,
      razaoSocial: r.razaoSocial,
      cpfPessoa: cpfByCliente.get(r.id) ?? '',
      email: r.email,
    })),
  };
}

export async function cleanAll(): Promise<void> {
  const p = getPrisma();
  await ensureTenant();

  const seedClients = await p.cliente.findMany({
    where: { email: { endsWith: SEED_EMAIL_DOMAIN } },
    select: { id: true },
  });
  const clientIds = seedClients.map((c) => c.id);

  const seedProtocols = [...Object.values(SEED_PROTOCOL), 'HIST-ISO', 'DEMO-RL'];
  const protocolFilter = seedProtocols.map((prefix) => ({ protocolo: { startsWith: prefix } }));

  console.log('   Limpando solicitações seed...');
  if (clientIds.length > 0 || protocolFilter.length > 0) {
    await p.solicitacao.deleteMany({
      where: {
        OR: [
          ...(clientIds.length ? [{ clienteId: { in: clientIds } }] : []),
          ...protocolFilter,
        ],
      },
    });
  }

  if (clientIds.length > 0) {
    console.log('   Limpando TOS (agendamentos/containers)...');
    const containers = await p.container.findMany({
      where: { clienteId: { in: clientIds } },
      select: { id: true },
    });
    if (containers.length) {
      await p.containerEvent.deleteMany({ where: { containerId: { in: containers.map((c) => c.id) } } });
      await p.container.deleteMany({ where: { id: { in: containers.map((c) => c.id) } } });
    }
    await p.agendamentoTerminal.deleteMany({ where: { clienteId: { in: clientIds } } });
    await p.tabelaTarifaria.deleteMany({ where: { clienteId: { in: clientIds } } });
    await p.user.deleteMany({
      where: { OR: [{ clienteId: { in: clientIds } }, { email: { endsWith: SEED_EMAIL_DOMAIN } }] },
    });
    await p.cliente.deleteMany({ where: { id: { in: clientIds } } });
  }

  console.log('   Limpando vínculos de equipamentos...');
  await p.cadastroEquipamentoVinculo.deleteMany({});

  console.log('   Limpando cache de contêineres seed...');
  await p.cadastroContainerCache.deleteMany({
    where: { numeroIso: { in: SEED_CONTAINERS.map((c) => c.numero) } },
  });

  console.log('   Limpando MDM cadastros seed...');
  const seedCnpjs = [
    gerarCnpj('270002450001'),
    gerarCnpj('270002450002'),
    gerarCnpj('270002450003'),
    gerarCnpj('270002450004'),
    gerarCnpj('270002450005'),
    gerarCnpj('270002450010'),
    gerarCnpj('270002450020'),
  ];
  const seedCpfs = [
    gerarCpf('111222333'),
    gerarCpf('222333444'),
    gerarCpf('333444555'),
    gerarCpf('444555666'),
    gerarCpf('555666777'),
    gerarCpf('123456789'),
    gerarCpf('987654321'),
    gerarCpf('456789123'),
    gerarCpf('321654987'),
  ];

  await p.cadastroMotorista.deleteMany({ where: { cpf: { in: seedCpfs } } });
  await p.cadastroTransportadora.deleteMany({ where: { cnpj: { in: seedCnpjs } } });
  await p.cadastroColaborador.deleteMany({ where: { cpf: { in: seedCpfs.slice(0, 5) } } });
  await p.cadastroEquipamento.deleteMany({
    where: { codigo: { in: ['EMP-01', 'EMP-02', 'RS-01', 'RS-02', 'EMP-03'] } },
  });

  const extraTipos = ['OT', 'FR', 'TANK'];
  await p.cadastroTipoContainer.deleteMany({ where: { codigo: { in: extraTipos } } });

  console.log('   Limpeza concluída.');
}

export function decimal(value: string | number): Prisma.Decimal {
  return new Prisma.Decimal(String(value));
}
