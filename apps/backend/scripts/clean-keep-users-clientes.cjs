/**
 * Limpa dados operacionais preservando identidade para testes.
 * Usa session_replication_role para não cascatear em users/clientes.
 *
 * Preserva:
 * - tenants, tenant_configs, feature_flags, _prisma_migrations, termos_uso
 * - users, clientes, pessoas_autorizadas, permissoes, transportadoras_autorizadas
 * - cadastros_tipos_container, cadastros_capacidades_container
 *
 * Uso: node scripts/clean-keep-users-clientes.cjs
 */
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
const { Pool } = require('pg');

const KEEP = new Set([
  '_prisma_migrations',
  'tenants',
  'tenant_configs',
  'users',
  'clientes',
  'pessoas_autorizadas',
  'permissoes_pessoa_autorizada',
  'transportadoras_autorizadas',
  'termos_uso',
  'cadastros_tipos_container',
  'cadastros_capacidades_container',
  'feature_flags',
]);

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não definido');

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    const wipe = rows.map((r) => r.tablename).filter((t) => !KEEP.has(t));
    if (!wipe.length) {
      console.log('Nada para limpar.');
      return;
    }

    console.log(`Preservando: ${[...KEEP].sort().join(', ')}`);
    console.log(`Limpando ${wipe.length} tabelas (sem CASCADE em users/clientes)...`);

    await client.query('BEGIN');
    // Desliga checagem de FK na sessão — evita TRUNCATE CASCADE puxar users/clientes.
    await client.query(`SET LOCAL session_replication_role = 'replica'`);
    const quoted = wipe.map((t) => `"${t}"`).join(', ');
    await client.query(`TRUNCATE TABLE ${quoted} RESTART IDENTITY`);
    await client.query(`SET LOCAL session_replication_role = 'origin'`);
    await client.query('COMMIT');

    const counts = await client.query(`
      SELECT 'users' AS t, COUNT(*)::int AS n FROM users
      UNION ALL SELECT 'clientes', COUNT(*)::int FROM clientes
      UNION ALL SELECT 'pessoas_autorizadas', COUNT(*)::int FROM pessoas_autorizadas
      UNION ALL SELECT 'solicitacoes', COUNT(*)::int FROM solicitacoes
      UNION ALL SELECT 'gate_v2_check_ins', COUNT(*)::int FROM gate_v2_check_ins
      UNION ALL SELECT 'cadastros_tipos_container', COUNT(*)::int FROM cadastros_tipos_container
      ORDER BY t
    `);
    console.log('Contagens após limpeza:');
    for (const row of counts.rows) console.log(`  ${row.t}: ${row.n}`);
    console.log('Limpeza concluída.');
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
