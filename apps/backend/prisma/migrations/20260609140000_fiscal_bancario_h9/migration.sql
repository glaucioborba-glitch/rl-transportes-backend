-- H9: integração fiscal/bancária — status e links de cobrança

ALTER TYPE "StatusPagamentoFatura" ADD VALUE IF NOT EXISTS 'PROCESSANDO';
ALTER TYPE "StatusPagamentoFatura" ADD VALUE IF NOT EXISTS 'AGUARDANDO_PAGAMENTO';

ALTER TABLE "faturas_armazenagem" ADD COLUMN IF NOT EXISTS "link_boleto" VARCHAR(500);
ALTER TABLE "faturas_armazenagem" ADD COLUMN IF NOT EXISTS "link_pix" VARCHAR(500);
ALTER TABLE "faturas_armazenagem" ADD COLUMN IF NOT EXISTS "numero_rps" VARCHAR(32);
ALTER TABLE "faturas_armazenagem" ADD COLUMN IF NOT EXISTS "serie_rps" VARCHAR(16);
ALTER TABLE "faturas_armazenagem" ADD COLUMN IF NOT EXISTS "processamento_erro" TEXT;

CREATE INDEX IF NOT EXISTS "faturas_armazenagem_status_pagamento_idx" ON "faturas_armazenagem"("status_pagamento");

ALTER TABLE "nfs_emitidas" ADD COLUMN IF NOT EXISTS "link_nfse_pdf" VARCHAR(500);
ALTER TABLE "nfs_emitidas" ADD COLUMN IF NOT EXISTS "rps_numero" VARCHAR(32);
ALTER TABLE "nfs_emitidas" ADD COLUMN IF NOT EXISTS "rps_serie" VARCHAR(16);

CREATE INDEX IF NOT EXISTS "nfs_emitidas_status_ipm_idx" ON "nfs_emitidas"("statusIpm");

ALTER TABLE "boletos" ADD COLUMN IF NOT EXISTS "link_pdf" VARCHAR(500);
ALTER TABLE "boletos" ADD COLUMN IF NOT EXISTS "pix_copia_cola" VARCHAR(512);
ALTER TABLE "boletos" ADD COLUMN IF NOT EXISTS "pix_qr_code_url" VARCHAR(500);
ALTER TABLE "boletos" ADD COLUMN IF NOT EXISTS "provedor" VARCHAR(64);
ALTER TABLE "boletos" ADD COLUMN IF NOT EXISTS "referencia_externa" VARCHAR(255);
