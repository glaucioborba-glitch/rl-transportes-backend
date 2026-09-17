-- Tipos de contêiner passam a ser catálogo global (Super Admin).
-- Um código por linha; tenants, gate e portal só leem.

DELETE FROM "cadastros_tipos_container" a
WHERE a.id NOT IN (
  SELECT keep.id
  FROM (
    SELECT DISTINCT ON ("codigo") id
    FROM "cadastros_tipos_container"
    ORDER BY
      "codigo",
      ("deleted_at" IS NULL) DESC,
      "ativo" DESC,
      ("tenant_id" = 'default') DESC,
      "updated_at" DESC
  ) keep
);

DROP INDEX IF EXISTS "cadastros_tipos_container_tenant_id_ativo_idx";
DROP INDEX IF EXISTS "cadastros_tipos_container_tenant_id_codigo_key";

ALTER TABLE "cadastros_tipos_container" DROP CONSTRAINT IF EXISTS "cadastros_tipos_container_tenant_id_fkey";

ALTER TABLE "cadastros_tipos_container" DROP COLUMN "tenant_id";

CREATE UNIQUE INDEX "cadastros_tipos_container_codigo_key" ON "cadastros_tipos_container"("codigo");
CREATE INDEX "cadastros_tipos_container_ativo_idx" ON "cadastros_tipos_container"("ativo");
