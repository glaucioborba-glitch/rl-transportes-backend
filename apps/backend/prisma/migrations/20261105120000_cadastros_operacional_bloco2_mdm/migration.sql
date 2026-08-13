-- CreateTable
CREATE TABLE "cadastros_tipos_container" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "codigo" VARCHAR(32) NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "tamanhos" JSONB NOT NULL DEFAULT '[]',
    "tomada_reefer" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cadastros_tipos_container_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cadastros_container_cache" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "numero_iso" VARCHAR(11) NOT NULL,
    "tipo" VARCHAR(64),
    "tamanho" VARCHAR(32),
    "primeira_passagem" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cadastros_container_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cadastros_equipamentos" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "codigo" VARCHAR(32) NOT NULL,
    "tipo" VARCHAR(64) NOT NULL,
    "marca" VARCHAR(120),
    "modelo" VARCHAR(120),
    "capacidade" VARCHAR(32),
    "altura_maxima" VARCHAR(32),
    "status" VARCHAR(32) NOT NULL DEFAULT 'DISPONIVEL',
    "horimetro" INTEGER NOT NULL DEFAULT 0,
    "ultima_manutencao" DATE,
    "proxima_manutencao" DATE,
    "centro_custo" VARCHAR(32),
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "dados" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cadastros_equipamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cadastros_equipamentos_vinculos" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "equipamento_id" TEXT NOT NULL,
    "operador_id" TEXT NOT NULL,
    "vinculado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "desvinculado_em" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cadastros_equipamentos_vinculos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cadastros_tipos_container_tenant_id_ativo_idx" ON "cadastros_tipos_container"("tenant_id", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "cadastros_tipos_container_tenant_id_codigo_key" ON "cadastros_tipos_container"("tenant_id", "codigo");

-- CreateIndex
CREATE INDEX "cadastros_container_cache_numero_iso_idx" ON "cadastros_container_cache"("numero_iso");

-- CreateIndex
CREATE UNIQUE INDEX "cadastros_container_cache_tenant_id_numero_iso_key" ON "cadastros_container_cache"("tenant_id", "numero_iso");

-- CreateIndex
CREATE INDEX "cadastros_equipamentos_tenant_id_status_idx" ON "cadastros_equipamentos"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cadastros_equipamentos_tenant_id_codigo_key" ON "cadastros_equipamentos"("tenant_id", "codigo");

-- CreateIndex
CREATE INDEX "cadastros_equipamentos_vinculos_operador_id_ativo_idx" ON "cadastros_equipamentos_vinculos"("operador_id", "ativo");

-- CreateIndex
CREATE INDEX "cadastros_equipamentos_vinculos_equipamento_id_ativo_idx" ON "cadastros_equipamentos_vinculos"("equipamento_id", "ativo");

-- AddForeignKey
ALTER TABLE "cadastros_tipos_container" ADD CONSTRAINT "cadastros_tipos_container_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cadastros_container_cache" ADD CONSTRAINT "cadastros_container_cache_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cadastros_equipamentos" ADD CONSTRAINT "cadastros_equipamentos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cadastros_equipamentos_vinculos" ADD CONSTRAINT "cadastros_equipamentos_vinculos_equipamento_id_fkey" FOREIGN KEY ("equipamento_id") REFERENCES "cadastros_equipamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cadastros_equipamentos_vinculos" ADD CONSTRAINT "cadastros_equipamentos_vinculos_operador_id_fkey" FOREIGN KEY ("operador_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed tipos padrão
INSERT INTO "cadastros_tipos_container" ("id", "tenant_id", "codigo", "nome", "tamanhos", "tomada_reefer", "ativo", "updated_at")
VALUES
  (gen_random_uuid()::text, 'default', 'DRY', 'Dry Container', '["20","40"]', false, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'default', 'REEFER', 'Reefer Container', '["20","40"]', true, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'default', 'HC', 'High Cube', '["40","45"]', false, true, CURRENT_TIMESTAMP)
ON CONFLICT ("tenant_id", "codigo") DO NOTHING;
