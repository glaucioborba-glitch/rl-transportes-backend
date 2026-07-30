import * as path from 'node:path';
import { config } from 'dotenv';
import { randomUUID } from 'crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { normalizeLoginDocumento } from '../src/common/utils/login-documento.util';

config({ path: path.resolve(__dirname, '../../../.env') });

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL não definido');

const pool = new Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const TODOS_SERVICOS = [
  'tracking_operacional',
  'tracking_financeiro',
  'sla_service',
  'ciclo_operacional',
  'patio_tempo_real',
  'produtividade_stats',
  'eventos_fiscal_financeiro',
  'faturamento_pagamentos',
];

async function seedTenantDefault() {
  await prisma.tenant.upsert({
    where: { id: 'default' },
    create: { id: 'default', slug: 'default', nome: 'Terminal corporativo (default)' },
    update: {},
  });
  await prisma.tenantConfig.upsert({
    where: { tenantId: 'default' },
    create: {
      tenantId: 'default',
      tenantKey: 'default',
      nome: 'Terminal corporativo (default)',
      parametros: {},
      clienteIds: [],
      slasMinutosMeta: { gate: 240, patio: 4320, saida: 1440 },
      horarioFuncionamento: '06:00–22:00 UTC',
      regrasOperacao: 'Tenant default — sem segregação de clientes até configurar.',
    },
    update: {},
  });
}

async function seedFornecedores() {
  const raw = process.env.CX_PORTAL_FORNECEDOR_SEED?.trim();
  if (!raw) return 0;
  let n = 0;
  for (const line of raw.split(/[\n;]+/).map((l) => l.trim()).filter(Boolean)) {
    const parts = line.split('|').map((p) => p.trim());
    if (parts.length < 3) continue;
    const [documento, password, tenantId, papelRaw] = parts;
    const cpfCnpj = normalizeLoginDocumento(documento);
    const hash = await bcrypt.hash(password, 10);
    await prisma.cxPortalFornecedorIdentity.upsert({
      where: { cpfCnpj },
      create: {
        id: randomUUID(),
        cpfCnpj,
        email: `cx-seed-${cpfCnpj}@fornecedor.local`,
        passwordHash: hash,
        tenantId: tenantId || 'default',
        papel: papelRaw === 'PARCEIRO' ? 'PARCEIRO' : 'FORNECEDOR',
      },
      update: {
        passwordHash: hash,
        tenantId: tenantId || 'default',
        papel: papelRaw === 'PARCEIRO' ? 'PARCEIRO' : 'FORNECEDOR',
      },
    });
    n++;
  }
  return n;
}

async function seedApiClients() {
  const raw =
    process.env.PLATAFORMA_API_CLIENTS ?? 'demo-pk|demo-sk|Cliente demo API|default|240';
  let n = 0;
  for (const chunk of raw.split(';').map((s) => s.trim()).filter(Boolean)) {
    const [apiKey, secret, label, tenantId, rpm, clientes] = chunk.split('|').map((s) => s.trim());
    if (!apiKey || !secret) continue;
    const ids = (clientes ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    await prisma.plataformaApiClientRecord.upsert({
      where: { apiKey },
      create: {
        id: randomUUID(),
        apiKey,
        secret,
        label: label || 'bootstrap',
        tenantId: tenantId || 'default',
        clienteIds: ids,
        requestsPerMinute: Math.max(10, parseInt(rpm || '120', 10) || 120),
        enabled: true,
        servicosHabilitados: TODOS_SERVICOS,
      },
      update: {
        secret,
        label: label || 'bootstrap',
        tenantId: tenantId || 'default',
        clienteIds: ids,
        requestsPerMinute: Math.max(10, parseInt(rpm || '120', 10) || 120),
        enabled: true,
        servicosHabilitados: TODOS_SERVICOS,
      },
    });
    n++;
  }
  return n;
}

async function main() {
  await seedTenantDefault();
  const forn = await seedFornecedores();
  const api = await seedApiClients();
  console.log(`[seed-cx-tenant] tenant default OK; fornecedores=${forn}; apiClients=${api}`);
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
