import * as path from 'node:path';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';

config({ path: path.resolve(__dirname, '../../../.env.production') });
config({ path: path.resolve(__dirname, '../../../.env') });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL não definido.');
}

if (
  process.env.NODE_ENV === 'production' &&
  process.env.ALLOW_PROD_SEED !== '1'
) {
  console.error('[seed-prod] Bloqueado em produção. Defina ALLOW_PROD_SEED=1.');
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const BCRYPT_ROUNDS = 12;

const DEFAULT_PARAMETROS = {
  branding: { corPrimaria: '#14b8a6' },
  operacao: {
    turnos: [
      { id: 'MANHA', nome: 'Manhã', inicio: '06:00', fim: '14:00' },
      { id: 'TARDE', nome: 'Tarde', inicio: '14:00', fim: '22:00' },
    ],
    exigeInspecaoGateIn: true,
    diasFreeTimePadrao: 7,
    capacidadeTotalSlots: 280,
    horarioFuncionamentoInicio: '06:00',
    horarioFuncionamentoFim: '22:00',
    limiteAgendamentosPorTurno: 15,
    operacaoFimSemana: false,
  },
  financeiro: {
    diasToleranciaBloqueioPadrao: 3,
    percentualMultaAtrasoPadrao: 2.0,
    percentualJurosAoMesPadrao: 1.0,
    condicaoPagamentoDefault: 'FATURAMENTO',
    emiteNfseAutomatico: false,
    emiteBoletoAutomatico: false,
    diasVencimentoBoletoPadrao: 7,
  },
};

function cpfStorage(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11) return digits.padStart(14, '0');
  if (digits.length === 14) return digits;
  throw new Error('SEED_ADMIN_CPF deve ter 11 ou 14 dígitos.');
}

async function main() {
  const tenantId = process.env.SEED_TENANT_ID ?? 'default';
  const tenantNome = process.env.SEED_TENANT_NOME ?? 'RL Transportes';
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@rltransportes.com.br';
  const adminCpf = cpfStorage(process.env.SEED_ADMIN_CPF ?? '52998224725');
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Mudar@123';

  console.log('🌱 Seed de produção...');

  await prisma.tenant.upsert({
    where: { id: tenantId },
    create: {
      id: tenantId,
      slug: tenantId,
      nome: tenantNome,
      status: 'ATIVO',
    },
    update: { nome: tenantNome },
  });
  console.log(`✅ Tenant: ${tenantNome} (${tenantId})`);

  const hash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);
  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId, email: adminEmail } },
    create: {
      tenantId,
      email: adminEmail,
      cpfCnpj: adminCpf,
      password: hash,
      role: Role.ADMIN,
      onboardingConcluido: true,
    },
    update: {
      password: hash,
      role: Role.ADMIN,
      cpfCnpj: adminCpf,
      onboardingConcluido: true,
    },
  });
  console.log(`✅ Admin: ${admin.email} (CPF armazenado: ${admin.cpfCnpj})`);

  await prisma.tenantConfig.upsert({
    where: { tenantId },
    create: {
      tenantId,
      tenantKey: tenantId,
      nome: tenantNome,
      parametros: DEFAULT_PARAMETROS,
      clienteIds: [],
      slasMinutosMeta: { gate: 240, patio: 4320, saida: 1440 },
      horarioFuncionamento: '06:00–22:00',
      regrasOperacao: 'Tenant produção — seed mínimo',
    },
    update: {
      nome: tenantNome,
      parametros: DEFAULT_PARAMETROS,
    },
  });
  console.log('✅ TenantConfig default');

  console.log('\n🌱 Seed concluído.');
  console.log(`   Login intranet: CPF ${process.env.SEED_ADMIN_CPF?.replace(/\D/g, '') ?? adminCpf.slice(-11)}`);
  console.log(`   E-mail: ${adminEmail}`);
  console.log('   ⚠ Altere a senha após o primeiro acesso.');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
