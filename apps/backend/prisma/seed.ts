import * as path from 'node:path';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma, Role, StatusSolicitacao, TipoCliente, TurnoAgendamento } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import {
  TERMOS_USO_CONTEUDO_HTML,
  TERMOS_USO_DATA_PUBLICACAO,
  TERMOS_USO_VERSAO_ATIVA,
} from '../src/common/legal/termos-uso.constants';

config({ path: path.resolve(__dirname, '../../../.env') });

const DEFAULT_TENANT = 'default';

const DEFAULT_TENANT_PARAMETROS = {
  branding: { corPrimaria: '#14b8a6' },
  operacao: {
    turnos: [
      { id: 'MANHA', nome: 'Manhã', inicio: '06:00', fim: '14:00' },
      { id: 'TARDE', nome: 'Tarde', inicio: '14:00', fim: '22:00' },
    ],
    exigeInspecaoGateIn: true,
    diasFreeTimePadrao: 7,
  },
};

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL não definido (carregue o .env da raiz do monorepo).');
}

const pool = new Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const BCRYPT_ROUNDS = 12;

async function upsertDefaultTenant() {
  await prisma.tenant.upsert({
    where: { id: DEFAULT_TENANT },
    create: {
      id: DEFAULT_TENANT,
      slug: DEFAULT_TENANT,
      nome: 'Terminal corporativo (default)',
    },
    update: {},
  });
  await prisma.tenantConfig.upsert({
    where: { tenantId: DEFAULT_TENANT },
    create: {
      tenantId: DEFAULT_TENANT,
      tenantKey: DEFAULT_TENANT,
      nome: 'Terminal corporativo (default)',
      parametros: DEFAULT_TENANT_PARAMETROS,
      clienteIds: [],
      slasHorasProxy: { gate: 4, patio: 72, saida: 24 },
      horarioFuncionamento: '06:00–22:00',
      regrasOperacao: 'Tenant default',
    },
    update: {},
  });
}

async function upsertClientePortal() {
  const cnpj = process.env.SEED_QA_CLIENTE_CNPJ ?? '19131243000197';
  const empresaEmail = process.env.SEED_QA_CLIENTE_EMAIL_EMPRESA ?? 'empresa.portal.qa@rl.local.test';
  return prisma.cliente.upsert({
    where: { tenantId_cpfCnpj: { tenantId: DEFAULT_TENANT, cpfCnpj: cnpj } },
    create: {
      tenantId: DEFAULT_TENANT,
      razaoSocial: 'Cliente QA · Portal Web LTDA',
      nomeFantasia: 'Cliente QA Portal',
      tipo: TipoCliente.PJ,
      cpfCnpj: cnpj,
      email: empresaEmail,
      emailNfse: empresaEmail,
      telefone: '47333344444',
      isentoIE: false,
      inscricaoMunicipal: null,
      inscricaoEstadual: null,
      enderecoLogradouro: 'Rua Industrial',
      enderecoNumero: '1000',
      enderecoComplemento: 'Galpão 2',
      enderecoBairro: 'Distrito Industrial',
      enderecoCidade: 'Navegantes',
      enderecoUf: 'SC',
      enderecoCep: '88370700',
      codigoMunicipioIbge: '4211306',
      responsavel: 'Responsável QA',
      responsavelTelefone: '4733221100',
      responsavelEmail: empresaEmail,
    },
    update: {
      razaoSocial: 'Cliente QA · Portal Web LTDA',
      nomeFantasia: 'Cliente QA Portal',
      email: empresaEmail,
      emailNfse: empresaEmail,
    },
  });
}

async function upsertTermosUsoAtivo() {
  await prisma.termosUso.updateMany({ where: { ativo: true }, data: { ativo: false } });
  await prisma.termosUso.upsert({
    where: { versao: TERMOS_USO_VERSAO_ATIVA },
    create: {
      versao: TERMOS_USO_VERSAO_ATIVA,
      conteudoHtml: TERMOS_USO_CONTEUDO_HTML,
      dataPublicacao: TERMOS_USO_DATA_PUBLICACAO,
      ativo: true,
    },
    update: {
      conteudoHtml: TERMOS_USO_CONTEUDO_HTML,
      dataPublicacao: TERMOS_USO_DATA_PUBLICACAO,
      ativo: true,
    },
  });
}

async function main() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const deploy = (process.env.DEPLOY_ENV || '').toLowerCase();
  if (
    (nodeEnv === 'production' || deploy === 'prod' || deploy === 'production') &&
    process.env.ALLOW_PROD_SEED !== '1'
  ) {
    console.error(
      '[seed] Bloqueado em produção. Defina ALLOW_PROD_SEED=1 apenas para override controlado.',
    );
    process.exit(1);
  }

  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@rltransportes.com';
  const adminDoc = process.env.SEED_ADMIN_CPF_CNPJ ?? '04252011000110';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await upsertDefaultTenant();
  await upsertTermosUsoAtivo();

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: DEFAULT_TENANT, email } },
    create: {
      tenantId: DEFAULT_TENANT,
      cpfCnpj: adminDoc,
      email,
      password: hash,
      role: Role.ADMIN,
    },
    update: {
      cpfCnpj: adminDoc,
      password: hash,
      role: Role.ADMIN,
    },
  });

  const superEmail = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'superadmin@rltransportes.com';
  const superDoc = process.env.SEED_SUPER_ADMIN_CPF_CNPJ ?? '00000000000191';
  const superPwd = process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'SuperAdmin@123';
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: DEFAULT_TENANT, email: superEmail } },
    create: {
      tenantId: DEFAULT_TENANT,
      cpfCnpj: superDoc,
      email: superEmail,
      password: await bcrypt.hash(superPwd, BCRYPT_ROUNDS),
      role: Role.SUPER_ADMIN,
    },
    update: {
      cpfCnpj: superDoc,
      password: await bcrypt.hash(superPwd, BCRYPT_ROUNDS),
      role: Role.SUPER_ADMIN,
    },
  });

  const clientePortal = await upsertClientePortal();
  const uClienteMail = process.env.SEED_QA_PORTAL_LOGIN_EMAIL ?? 'cliente.portal.qa@rl.local.test';
  const uClientePwd = process.env.SEED_QA_PORTAL_LOGIN_PASSWORD ?? 'Cliente@PortalQA2026';
  const uClienteDoc = clientePortal.cpfCnpj;
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: DEFAULT_TENANT, email: uClienteMail } },
    create: {
      tenantId: DEFAULT_TENANT,
      cpfCnpj: uClienteDoc,
      email: uClienteMail,
      password: await bcrypt.hash(uClientePwd, BCRYPT_ROUNDS),
      role: Role.ADMIN_CLIENTE,
      clienteId: clientePortal.id,
    },
    update: {
      cpfCnpj: uClienteDoc,
      password: await bcrypt.hash(uClientePwd, BCRYPT_ROUNDS),
      role: Role.ADMIN_CLIENTE,
      clienteId: clientePortal.id,
    },
  });

  const qaPessoaCpf = process.env.SEED_QA_PESSOA_CPF ?? '52998224725';
  const qaPessoaNome = process.env.SEED_QA_PESSOA_NOME ?? 'Operador QA Portal';
  const qaPessoaEmail = process.env.SEED_QA_PESSOA_EMAIL ?? 'operador.qa@rl.local.test';
  const pessoaExistente = await prisma.pessoaAutorizada.findFirst({
    where: { clienteId: clientePortal.id, cpf: qaPessoaCpf },
  });
  const qaPermissoes = {
    podeCriarSolicitacao: true,
    podeAnexarDocumentos: true,
    podeAgendarTurno: true,
    podeVisualizarFinanceiro: true,
    podeAprovarOS: true,
    podeVerOS: true,
    podeAlterarDadosGate: false,
    podeGerarPDF: true,
    podeGerenciarPessoas: true,
  };
  if (pessoaExistente) {
    await prisma.pessoaAutorizada.update({
      where: { id: pessoaExistente.id },
      data: { nome: qaPessoaNome, email: qaPessoaEmail, ativo: true },
    });
    await prisma.permissaoPessoaAutorizada.upsert({
      where: { pessoaId: pessoaExistente.id },
      create: {
        pessoaId: pessoaExistente.id,
        ...qaPermissoes,
      },
      update: qaPermissoes,
    });
  } else {
    await prisma.pessoaAutorizada.create({
      data: {
        clienteId: clientePortal.id,
        nome: qaPessoaNome,
        email: qaPessoaEmail,
        cpf: qaPessoaCpf,
        telefone: '4733221100',
        permissoes: {
          create: qaPermissoes,
        },
      },
    });
  }

  const gEmail = process.env.SEED_QA_GERENTE_EMAIL ?? 'gerente.ops.qa@rl.local.test';
  const gPwd = process.env.SEED_QA_GERENTE_PASSWORD ?? 'Gerente@OpsQA2026';
  const gDoc = process.env.SEED_QA_GERENTE_CPF_CNPJ ?? '11000000000108';
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: DEFAULT_TENANT, email: gEmail } },
    create: {
      tenantId: DEFAULT_TENANT,
      cpfCnpj: gDoc,
      email: gEmail,
      password: await bcrypt.hash(gPwd, BCRYPT_ROUNDS),
      role: Role.GERENTE,
    },
    update: {
      cpfCnpj: gDoc,
      password: await bcrypt.hash(gPwd, BCRYPT_ROUNDS),
      role: Role.GERENTE,
    },
  });

  const opMail = process.env.SEED_QA_OPERADOR_EMAIL ?? 'operador.portaria.qa@rl.local.test';
  const opPwd = process.env.SEED_QA_OPERADOR_PASSWORD ?? 'OpsPrt@QA2026';
  const opDoc = process.env.SEED_QA_OPERADOR_CPF_CNPJ ?? '11000000000299';
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: DEFAULT_TENANT, email: opMail } },
    create: {
      tenantId: DEFAULT_TENANT,
      cpfCnpj: opDoc,
      email: opMail,
      password: await bcrypt.hash(opPwd, BCRYPT_ROUNDS),
      role: Role.OPERADOR_PORTARIA,
    },
    update: {
      cpfCnpj: opDoc,
      password: await bcrypt.hash(opPwd, BCRYPT_ROUNDS),
      role: Role.OPERADOR_PORTARIA,
    },
  });

  const supMail =
    process.env.SEED_QA_OPERADOR_SUPERVISOR_EMAIL ?? 'operador.supervisor.qa@rl.local.test';
  const supPwd = process.env.SEED_QA_OPERADOR_SUPERVISOR_PASSWORD ?? 'OpsSup@QA2026';
  const supDoc = process.env.SEED_QA_OPERADOR_SUPERVISOR_CPF_CNPJ ?? '11000000000370';
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: DEFAULT_TENANT, email: supMail } },
    create: {
      tenantId: DEFAULT_TENANT,
      cpfCnpj: supDoc,
      email: supMail,
      password: await bcrypt.hash(supPwd, BCRYPT_ROUNDS),
      role: Role.OPERADOR_PORTARIA,
    },
    update: {
      cpfCnpj: supDoc,
      password: await bcrypt.hash(supPwd, BCRYPT_ROUNDS),
      role: Role.OPERADOR_PORTARIA,
    },
  });

  const gateMail = process.env.SEED_QA_OPERADOR_GATE_EMAIL ?? 'operador.gate.qa@rl.local.test';
  const gatePwd = process.env.SEED_QA_OPERADOR_GATE_PASSWORD ?? 'OpsGate@QA2026';
  const gateDoc = process.env.SEED_QA_OPERADOR_GATE_CPF_CNPJ ?? '11000000000450';
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: DEFAULT_TENANT, email: gateMail } },
    create: {
      tenantId: DEFAULT_TENANT,
      cpfCnpj: gateDoc,
      email: gateMail,
      password: await bcrypt.hash(gatePwd, BCRYPT_ROUNDS),
      role: Role.OPERADOR_GATE,
    },
    update: {
      cpfCnpj: gateDoc,
      password: await bcrypt.hash(gatePwd, BCRYPT_ROUNDS),
      role: Role.OPERADOR_GATE,
    },
  });

  await prisma.capacidadeTurnoTerminal.upsert({
    where: { turno: TurnoAgendamento.MANHA },
    create: { turno: TurnoAgendamento.MANHA, limiteContainers: 40 },
    update: { limiteContainers: 40 },
  });
  await prisma.capacidadeTurnoTerminal.upsert({
    where: { turno: TurnoAgendamento.TARDE },
    create: { turno: TurnoAgendamento.TARDE, limiteContainers: 35 },
    update: { limiteContainers: 35 },
  });

  await prisma.solicitacao.upsert({
    where: { protocolo: 'QA-DEV-SOL-PENDENTE' },
    create: {
      protocolo: 'QA-DEV-SOL-PENDENTE',
      clienteId: clientePortal.id,
      status: StatusSolicitacao.PENDENTE,
    },
    update: { status: StatusSolicitacao.PENDENTE },
  });

  await prisma.tabelaTarifaria.upsert({
    where: { clienteId: clientePortal.id },
    create: {
      clienteId: clientePortal.id,
      freeTimeDias: 5,
      valorDiaria: new Prisma.Decimal('85.00'),
      valorServicosExtras: new Prisma.Decimal('120.00'),
    },
    update: {
      freeTimeDias: 5,
      valorDiaria: new Prisma.Decimal('85.00'),
      valorServicosExtras: new Prisma.Decimal('120.00'),
    },
  });

  console.log(`Seed OK: ADMIN ${email}; persona QA (CLIENTE portal, GERENTE, OPERADORES + solicitação). Credenciais no topo de apps/backend/prisma/seed.ts.`);
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
