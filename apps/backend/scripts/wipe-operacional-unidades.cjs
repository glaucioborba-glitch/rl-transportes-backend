/**
 * Apaga unidades e o fluxo operacional (solicitação → portaria → gate → pátio → ID).
 * Mantém cadastros, usuários, clientes e tabelas comerciais.
 *
 * Uso: node scripts/wipe-operacional-unidades.cjs
 */
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
const { Pool } = require('pg');

const WIPE = [
  'patio_v2_tomada_eventos',
  'patio_v2_movimentacoes',
  'patio_v2_unidades',
  'unidade_processo_servicos',
  'cessoes_titularidade',
  'alugueis',
  'itens_fatura_armazenagem',
  'pre_faturas',
  'faturas_armazenagem',
  'faturamento_itens',
  'faturamento_solicitacoes',
  'faturamentos',
  'nfs_emitidas',
  'boletos',
  'fotos_vistoria',
  'vistorias',
  'bloqueios_container',
  'gate_v2_check_outs',
  'gate_v2_check_ins',
  'portarias',
  'gates',
  'patios',
  'saidas',
  'unidades_solicitacao',
  'containers_solicitacao',
  'transporte_solicitacao',
  'agendamentos_solicitacao',
  'solicitante_contato',
  'solicitacao_anexos',
  'solicitacoes',
  'unidade_processos',
  'agendamentos_terminal',
  'cadastros_container_cache',
  'portal_notificacoes',
  'outbox_events',
  'pilhas_logicas',
  'fretes',
  'ordens_transporte',
  'veiculos',
  'motoristas',
  'mobile_ops_queue',
  'mobile_offline_events',
  'mobile_hub_ops',
];

const COUNTS = [
  'solicitacoes',
  'unidade_processos',
  'patio_v2_unidades',
  'gate_v2_check_ins',
  'portarias',
  'alugueis',
  'pre_faturas',
  'cadastros_unidades_aluguel',
  'cadastros_tipos_container',
  'users',
  'clientes',
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não definido (.env na raiz).');

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    const { rows: existing } = await client.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `);
    const have = new Set(existing.map((r) => r.tablename));
    const wipe = WIPE.filter((t) => have.has(t));
    const missing = WIPE.filter((t) => !have.has(t));
    if (missing.length) console.log(`Tabelas ausentes (ok): ${missing.join(', ')}`);

    const before = await client.query(
      COUNTS.filter((t) => have.has(t))
        .map((t) => `SELECT '${t}' AS t, COUNT(*)::int AS n FROM "${t}"`)
        .join(' UNION ALL '),
    );
    console.log('Antes:');
    for (const row of before.rows) console.log(`  ${row.t}: ${row.n}`);

    await client.query('BEGIN');
    await client.query(`SET LOCAL session_replication_role = 'replica'`);
    const quoted = wipe.map((t) => `"${t}"`).join(', ');
    await client.query(`TRUNCATE TABLE ${quoted} RESTART IDENTITY`);
    await client.query(`SET LOCAL session_replication_role = 'origin'`);

    if (have.has('cadastros_unidades_aluguel')) {
      await client.query(`
        UPDATE cadastros_unidades_aluguel
        SET status = 'DISPONIVEL'
        WHERE status = 'ALUGADA' AND deleted_at IS NULL
      `);
    }
    if (have.has('cadastros_posicoes_patio')) {
      await client.query(`
        UPDATE cadastros_posicoes_patio
        SET container_atual = NULL, status = 'LIVRE'
        WHERE container_atual IS NOT NULL OR status <> 'LIVRE'
      `);
    }

    const seq = await client.query(`
      SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'unidade_processos_numero_seq'
    `);
    if (seq.rowCount) {
      await client.query(`ALTER SEQUENCE unidade_processos_numero_seq RESTART WITH 1`);
    }

    await client.query('COMMIT');

    const after = await client.query(
      COUNTS.filter((t) => have.has(t))
        .map((t) => `SELECT '${t}' AS t, COUNT(*)::int AS n FROM "${t}"`)
        .join(' UNION ALL '),
    );
    console.log('Depois:');
    for (const row of after.rows) console.log(`  ${row.t}: ${row.n}`);
    console.log('Operacional limpo. Cadastros, usuários e clientes preservados.');
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
