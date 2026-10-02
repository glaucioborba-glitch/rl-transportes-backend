/**
 * Garante o usuário SUPER_ADMIN do dono no tenant default.
 * Lê CPF/e-mail/senha de SEED_SUPER_ADMIN_* no .env da raiz — não hardcode senha.
 *
 * Uso: npx ts-node --compiler-options {"module":"CommonJS"} scripts/ensure-super-admin.ts
 */
import * as path from 'node:path';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';

config({ path: path.resolve(__dirname, '../../../.env') });

const DEFAULT_TENANT = 'default';
const BCRYPT_ROUNDS = 12;
const CPF_DONO_11 = '03650163900';

function staffCpfStorage(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11) return digits.padStart(14, '0');
  if (digits.length === 14) return digits;
  throw new Error(`Documento inválido: ${raw}`);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não definido.');

  const email = (process.env.SEED_SUPER_ADMIN_EMAIL ?? 'superadmin@rltransportes.com').toLowerCase();
  const cpfCnpj = staffCpfStorage(process.env.SEED_SUPER_ADMIN_CPF ?? CPF_DONO_11);
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  if (!password) throw new Error('SEED_SUPER_ADMIN_PASSWORD é obrigatório.');

  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: DEFAULT_TENANT, email } },
      create: {
        tenantId: DEFAULT_TENANT,
        cpfCnpj,
        email,
        password: hash,
        role: Role.SUPER_ADMIN,
      },
      update: {
        cpfCnpj,
        password: hash,
        role: Role.SUPER_ADMIN,
        tokenVersion: { increment: 1 },
      },
    });
    console.log(`SUPER_ADMIN ok · id=${user.id} · cpf=${cpfCnpj} · ${email}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

void main();
