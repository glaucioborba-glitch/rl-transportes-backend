ALTER TYPE "StatusPixCreditoComprovante" ADD VALUE IF NOT EXISTS 'APROVADO';
ALTER TYPE "StatusPixCreditoComprovante" ADD VALUE IF NOT EXISTS 'NEGADO';
ALTER TYPE "TipoNotificacaoPortal" ADD VALUE IF NOT EXISTS 'PIX_CREDITO_APROVADO';
ALTER TYPE "TipoNotificacaoPortal" ADD VALUE IF NOT EXISTS 'PIX_CREDITO_NEGADO';

ALTER TABLE "cliente_conta_corrente_lancamentos"
  ADD COLUMN IF NOT EXISTS "anexo_nome" VARCHAR(180),
  ADD COLUMN IF NOT EXISTS "anexo_mime" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "anexo_storage_key" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "anexo_tamanho" INTEGER;

ALTER TABLE "cliente_pix_credito_comprovantes"
  ADD COLUMN IF NOT EXISTS "decisao_observacao" VARCHAR(500);
