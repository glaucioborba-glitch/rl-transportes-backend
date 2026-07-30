-- PR-02: Diárias de armazenagem em dias corridos (sem skip de fim de semana no billing).
-- Mudança comportamental no TypeScript — esta migration registra a regra de negócio.

INSERT INTO "audit_logs" (
  "id",
  "tenant_id",
  "entidade_id",
  "entidade_tipo",
  "categoria",
  "acao",
  "usuario_id",
  "usuario_nome",
  "usuario_role",
  "descricao_narrativa",
  "dados_novos",
  "criado_em"
)
VALUES (
  'migration_billing_diarias_corridas',
  'default',
  'billing-engine',
  'RegraNegocio',
  'FINANCEIRO',
  'REGRA_NEGOCIO_ALTERADA',
  'system',
  'Migration',
  'SYSTEM',
  'Contagem de diárias de armazenagem alterada para dias corridos (incluindo fins de semana e feriados). O flag operacaoFimSemana agora restringe apenas agendamentos, não cobrança.',
  '{"impacto": "billing-engine", "funcao_alterada": "diffDiasCalendario"}'::jsonb,
  NOW()
)
ON CONFLICT ("id") DO NOTHING;

UPDATE "tenant_configs"
SET "parametros" = jsonb_set(
  COALESCE("parametros", '{}'::jsonb),
  '{operacional,descricaoFimSemana}',
  '"So restringe agendamentos - cobranca sempre em dias corridos"'::jsonb
)
WHERE "tenant_id" = 'default';
