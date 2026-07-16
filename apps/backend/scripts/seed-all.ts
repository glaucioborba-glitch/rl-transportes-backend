/**
 * Seed completo do RL Terminal — Cadastros + Portal + Gate CPO.
 *
 * Uso:
 *   npx ts-node scripts/seed-all.ts              → popula tudo
 *   npx ts-node scripts/seed-all.ts --clean        → limpa e popula
 *   npx ts-node scripts/seed-all.ts --cadastros    → só MDM cadastros
 *   npx ts-node scripts/seed-all.ts --portal       → só portal (clientes + solicitações)
 *   npx ts-node scripts/seed-all.ts --gate         → só gate (requer clientes seed no banco)
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { seedCadastros } from './seed-cadastros';
import { seedGate } from './seed-gate';
import { seedPortal } from './seed-portal';
import {
  cleanAll,
  disconnectPrisma,
  findSeedClientes,
  SEED_CLIENT_PASSWORD,
  SEED_CONTAINERS,
  type SeedPortalIds,
} from './seed-utils';

function fmtCnpj(d: string): string {
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function fmtCpf(d: string): string {
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function writeCredentialsFile(portalClientes: SeedPortalIds['clientes']) {
  const lines = [
    'RL TRANSPORTES — Dados de teste (seed-all)',
    '==========================================',
    'Gerado por: apps/backend/scripts/seed-all.ts',
    'Ambiente: desenvolvimento local APENAS.',
    '',
    'Pré-requisito: npx prisma db seed (usuários staff)',
    'Recriar dados: npm run seed:clean (em apps/backend)',
    '',
    'URLs:',
    '  Staff login:  http://localhost:3000/auth/login',
    '  Portal login: http://localhost:3000/portal/login',
    '  Gate CPO:     http://localhost:3000/operador/gate/dashboard',
    '  Histórico:    http://localhost:3000/operador/gate/historico-container',
    '',
    'STAFF (intranet)',
    '  ADMIN:         04252011000110 / Admin@123',
    '  GERENTE:       11000000000108 / Gerente@OpsQA2026',
    '  OPERADOR GATE: 11000000000450 / OpsGate@QA2026',
    '',
    `PORTAL — senha comum: ${SEED_CLIENT_PASSWORD}`,
    '  Login com CNPJ → 2º passo com CPF da pessoa autorizada.',
    '',
  ];

  for (const c of portalClientes) {
    lines.push(`--- ${c.razaoSocial} ---`);
    lines.push(`  CNPJ login:  ${c.cnpj} (${fmtCnpj(c.cnpj)})`);
    lines.push(`  CPF pessoa:  ${c.cpfPessoa} (${fmtCpf(c.cpfPessoa)})`);
    lines.push(`  E-mail:      ${c.email}`);
    lines.push('');
  }

  lines.push('GATE CPO — contagens esperadas após seed completo:');
  lines.push('  Autorizações pendentes: 14');
  lines.push('  Operação ativa:         8');
  lines.push('  Despacho:               4');
  lines.push('  Portal solicitações:    10');
  lines.push('');
  lines.push(`HISTÓRICO DE CONTÊINER — buscar: ${SEED_CONTAINERS[0].numero.slice(0, 4)} ${SEED_CONTAINERS[0].numero.slice(4, 10)}-${SEED_CONTAINERS[0].numero.slice(10)}`);
  lines.push('  5 passagens (CHEIO/VAZIO alternados, 1 sem saída)');
  lines.push('');

  const outPath = path.resolve(__dirname, '../../../dados-teste-seed-all.txt');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  return outPath;
}

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_SEED !== '1') {
    console.error('[seed-all] Bloqueado em produção. Defina ALLOW_PROD_SEED=1 para forçar.');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const clean = args.includes('--clean');
  const onlyCadastros = args.includes('--cadastros');
  const onlyPortal = args.includes('--portal');
  const onlyGate = args.includes('--gate');
  const all = !onlyCadastros && !onlyPortal && !onlyGate;

  console.log('🌱 RL Terminal — Seed Data\n');

  if (clean) {
    console.log('🧹 Limpando dados seed existentes...');
    await cleanAll();
    console.log('✅ Dados limpos.\n');
  }

  let cadastrosIds = {
    tiposContainer: [] as string[],
    colaboradores: [] as string[],
    transportadoras: [] as string[],
    motoristas: [] as string[],
    equipamentos: [] as string[],
  };
  let portalIds: SeedPortalIds = { clientes: [] };

  if (all || onlyCadastros) {
    console.log('📦 Populando Cadastros (MDM)...');
    cadastrosIds = await seedCadastros();
    console.log(
      `✅ Cadastros: ${cadastrosIds.tiposContainer.length} tipos, ${cadastrosIds.colaboradores.length} colaboradores, ${cadastrosIds.transportadoras.length} transportadoras, ${cadastrosIds.motoristas.length} motoristas, ${cadastrosIds.equipamentos.length} equipamentos\n`,
    );
  }

  if (all || onlyPortal) {
    console.log('🌐 Populando Portal do Cliente...');
    portalIds = await seedPortal(cadastrosIds);
    console.log(`✅ Portal: ${portalIds.clientes.length} clientes, 10 solicitações\n`);
  }

  if (all || onlyGate) {
    if (portalIds.clientes.length === 0) {
      portalIds = await findSeedClientes();
    }
    if (portalIds.clientes.length === 0) {
      throw new Error('Clientes seed não encontrados — rode com --portal ou seed completo primeiro.');
    }
    if (cadastrosIds.equipamentos.length === 0 && (all || onlyGate)) {
      if (!onlyGate) {
        // cadastros já rodou no bloco acima
      } else {
        cadastrosIds = await seedCadastros();
      }
    }
    console.log('🚛 Populando Gate CPO...');
    await seedGate(cadastrosIds, portalIds);
    console.log('✅ Gate CPO: 14 autorizações, 8 operações ativas, 4 despachos, cache + histórico\n');
  }

  const credsFile = writeCredentialsFile(
    portalIds.clientes.length ? portalIds.clientes : (await findSeedClientes()).clientes,
  );

  console.log('🎉 Seed completo!');
  console.log('\n📋 Dados de acesso para teste:');
  console.log('   Staff ADMIN:  04252011000110 / Admin@123');
  console.log(`   Portal:       CNPJ dos clientes seed / ${SEED_CLIENT_PASSWORD}`);
  console.log(`   Credenciais:  ${credsFile}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectPrisma();
  });
