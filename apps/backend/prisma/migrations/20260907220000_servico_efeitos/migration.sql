ALTER TABLE "cadastros_servico_itens"
  ADD COLUMN IF NOT EXISTS "efeito" VARCHAR(32) NOT NULL DEFAULT 'NENHUM',
  ADD COLUMN IF NOT EXISTS "efeito_config" JSONB;

ALTER TABLE "unidade_processos"
  ADD COLUMN IF NOT EXISTS "lacre_saida" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "lacre_saida_origem" VARCHAR(16),
  ADD COLUMN IF NOT EXISTS "lacre_saida_observacao" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "faturar_handling_como_cheio" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "unidade_processo_servicos"
  ADD COLUMN IF NOT EXISTS "payload" JSONB;
