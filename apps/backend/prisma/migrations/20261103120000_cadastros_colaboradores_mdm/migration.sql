-- MDM Colaboradores (módulo Cadastros — PR 3)
CREATE TABLE "cadastros_colaboradores" (
    "id" VARCHAR(36) NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "nome" VARCHAR(255) NOT NULL,
    "cpf" VARCHAR(11) NOT NULL,
    "matricula" VARCHAR(32),
    "cargo" VARCHAR(120),
    "departamento" VARCHAR(64),
    "vinculo" VARCHAR(32) NOT NULL DEFAULT 'CLT',
    "status" VARCHAR(32) NOT NULL DEFAULT 'ATIVO',
    "data_admissao" DATE NOT NULL,
    "gestor_id" VARCHAR(36),
    "centro_custo_codigo" VARCHAR(32),
    "centro_custo_nome" VARCHAR(120),
    "dados" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cadastros_colaboradores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cadastros_colaboradores_tenant_id_cpf_key"
    ON "cadastros_colaboradores"("tenant_id", "cpf");

CREATE INDEX "cadastros_colaboradores_tenant_id_status_idx"
    ON "cadastros_colaboradores"("tenant_id", "status");

CREATE INDEX "cadastros_colaboradores_tenant_id_vinculo_idx"
    ON "cadastros_colaboradores"("tenant_id", "vinculo");

CREATE INDEX "cadastros_colaboradores_gestor_id_idx"
    ON "cadastros_colaboradores"("gestor_id");

ALTER TABLE "cadastros_colaboradores"
    ADD CONSTRAINT "cadastros_colaboradores_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cadastros_colaboradores"
    ADD CONSTRAINT "cadastros_colaboradores_gestor_id_fkey"
    FOREIGN KEY ("gestor_id") REFERENCES "cadastros_colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
