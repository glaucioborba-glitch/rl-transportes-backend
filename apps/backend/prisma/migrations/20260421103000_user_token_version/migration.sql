-- Revogação global de tokens (logout): versão incrementada invalida sessões antigas.
ALTER TABLE "users" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
