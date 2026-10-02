-- Template FIR Nitgen do motorista (tenant + CPF). Não é imagem da digital.
CREATE TABLE "motorista_biometria" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "cpf" VARCHAR(11) NOT NULL,
    "fir_text" TEXT NOT NULL,
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enrolled_by_user_id" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "motorista_biometria_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "motorista_biometria_tenant_id_cpf_key"
  ON "motorista_biometria"("tenant_id", "cpf");

CREATE INDEX "motorista_biometria_tenant_id_idx"
  ON "motorista_biometria"("tenant_id");

ALTER TABLE "motorista_biometria"
  ADD CONSTRAINT "motorista_biometria_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
