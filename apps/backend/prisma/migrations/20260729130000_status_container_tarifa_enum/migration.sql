-- Alinha colunas TEXT de status_container ao enum Prisma StatusContainerTarifa
DO $$ BEGIN
  CREATE TYPE "StatusContainerTarifa" AS ENUM ('AMBOS', 'CHEIO', 'VAZIO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "cadastros_tabelas_preco_itens"
  ALTER COLUMN "status_container" DROP DEFAULT,
  ALTER COLUMN "status_container" TYPE "StatusContainerTarifa"
    USING ("status_container"::text::"StatusContainerTarifa"),
  ALTER COLUMN "status_container" SET DEFAULT 'AMBOS';

ALTER TABLE "regras_tarifarias"
  ALTER COLUMN "status_container" DROP DEFAULT,
  ALTER COLUMN "status_container" TYPE "StatusContainerTarifa"
    USING (COALESCE("status_container", 'AMBOS')::text::"StatusContainerTarifa"),
  ALTER COLUMN "status_container" SET DEFAULT 'AMBOS';
