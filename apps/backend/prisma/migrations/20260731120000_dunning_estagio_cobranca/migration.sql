-- Régua de cobrança (Dunning) — rastreamento de estágio por fatura.

CREATE TYPE "EstagioCobranca" AS ENUM (
  'NENHUM',
  'PRE_VENCIMENTO',
  'VENCIMENTO_HOJE',
  'ATRASO_LEVE',
  'PRE_BLOQUEIO'
);

ALTER TABLE "faturas_armazenagem"
  ADD COLUMN IF NOT EXISTS "estagio_cobranca" "EstagioCobranca" NOT NULL DEFAULT 'NENHUM';

CREATE INDEX IF NOT EXISTS "faturas_armazenagem_estagio_cobranca_idx"
  ON "faturas_armazenagem"("estagio_cobranca");
