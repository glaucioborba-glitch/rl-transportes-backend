-- Versionamento de credencial QR (invalidação dinâmica após alterações no gate)

ALTER TABLE "solicitacoes" ADD COLUMN "versao_credencial" INTEGER NOT NULL DEFAULT 1;
