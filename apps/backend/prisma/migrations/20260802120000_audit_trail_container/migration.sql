-- Audit Trail centrado no contêiner: categorias, ISO indexado e narrativa humana.

CREATE TYPE "CategoriaAuditLog" AS ENUM ('OPERACIONAL', 'FINANCEIRO', 'SEGURANCA', 'SISTEMA');

ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "categoria" "CategoriaAuditLog" NOT NULL DEFAULT 'SISTEMA';
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "container_iso" VARCHAR(16);
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "descricao_narrativa" TEXT NOT NULL DEFAULT '';
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "ip_address" VARCHAR(64);

ALTER TABLE "audit_logs" ALTER COLUMN "acao" TYPE VARCHAR(64);
ALTER TABLE "audit_logs" ALTER COLUMN "usuario_id" TYPE VARCHAR(64);

CREATE INDEX IF NOT EXISTS "audit_logs_container_iso_idx" ON "audit_logs"("container_iso");
CREATE INDEX IF NOT EXISTS "audit_logs_categoria_idx" ON "audit_logs"("categoria");
