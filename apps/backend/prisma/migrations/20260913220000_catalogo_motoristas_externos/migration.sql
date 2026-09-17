-- Motoristas externos por terminal (autofill + suspensão). Isolado por tenant.
CREATE TABLE "catalogo_motoristas_externos" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "cpf" VARCHAR(11) NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "origem" VARCHAR(32) NOT NULL DEFAULT 'PORTAL',
    "suspenso_ate" TIMESTAMP(3),
    "suspensao_dias" INTEGER,
    "suspensao_motivo" VARCHAR(500),
    "suspenso_em" TIMESTAMP(3),
    "suspenso_por_user_id" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalogo_motoristas_externos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "catalogo_motoristas_externos_tenant_id_cpf_key" ON "catalogo_motoristas_externos"("tenant_id", "cpf");
CREATE INDEX "catalogo_motoristas_externos_tenant_id_suspenso_ate_idx" ON "catalogo_motoristas_externos"("tenant_id", "suspenso_ate");

ALTER TABLE "catalogo_motoristas_externos" ADD CONSTRAINT "catalogo_motoristas_externos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
