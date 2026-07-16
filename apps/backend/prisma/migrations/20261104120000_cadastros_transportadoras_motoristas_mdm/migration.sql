-- CreateTable
CREATE TABLE "cadastros_transportadoras" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "razao_social" VARCHAR(255) NOT NULL,
    "nome_fantasia" VARCHAR(255),
    "cnpj" VARCHAR(14) NOT NULL,
    "rntrc" VARCHAR(8),
    "rntrc_validade" DATE,
    "ie" VARCHAR(32),
    "email" VARCHAR(255),
    "telefone" VARCHAR(20),
    "cidade" VARCHAR(120),
    "uf" VARCHAR(2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "dados" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cadastros_transportadoras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cadastros_motoristas" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "nome" VARCHAR(255) NOT NULL,
    "cpf" VARCHAR(11) NOT NULL,
    "transportadora_id" VARCHAR(36) NOT NULL,
    "cnh_numero" VARCHAR(20),
    "cnh_categoria" VARCHAR(4),
    "cnh_validade" DATE,
    "cnh_uf_emissao" VARCHAR(2),
    "celular" VARCHAR(20),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "dados" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cadastros_motoristas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cadastros_transportadoras_tenant_id_ativo_idx" ON "cadastros_transportadoras"("tenant_id", "ativo");

-- CreateIndex
CREATE INDEX "cadastros_transportadoras_rntrc_idx" ON "cadastros_transportadoras"("rntrc");

-- CreateIndex
CREATE UNIQUE INDEX "cadastros_transportadoras_tenant_id_cnpj_key" ON "cadastros_transportadoras"("tenant_id", "cnpj");

-- CreateIndex
CREATE INDEX "cadastros_motoristas_tenant_id_ativo_idx" ON "cadastros_motoristas"("tenant_id", "ativo");

-- CreateIndex
CREATE INDEX "cadastros_motoristas_transportadora_id_idx" ON "cadastros_motoristas"("transportadora_id");

-- CreateIndex
CREATE UNIQUE INDEX "cadastros_motoristas_tenant_id_cpf_key" ON "cadastros_motoristas"("tenant_id", "cpf");

-- AddForeignKey
ALTER TABLE "cadastros_transportadoras" ADD CONSTRAINT "cadastros_transportadoras_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cadastros_motoristas" ADD CONSTRAINT "cadastros_motoristas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cadastros_motoristas" ADD CONSTRAINT "cadastros_motoristas_transportadora_id_fkey" FOREIGN KEY ("transportadora_id") REFERENCES "cadastros_transportadoras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
