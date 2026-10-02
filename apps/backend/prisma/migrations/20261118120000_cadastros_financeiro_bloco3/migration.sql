-- Bloco 3 Financeiro: Bancos, Centros de Custo, Plano de Contas, Tabelas de Preços

CREATE TABLE "cadastros_bancos" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "codigo" VARCHAR(8) NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "cnpj" VARCHAR(14),
    "site" VARCHAR(255),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cadastros_bancos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cadastros_centros_custo" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "codigo" VARCHAR(32) NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "tipo" VARCHAR(16) NOT NULL DEFAULT 'ANALITICO',
    "pai_id" TEXT,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cadastros_centros_custo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cadastros_plano_contas" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "codigo" VARCHAR(32) NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "natureza" VARCHAR(16) NOT NULL DEFAULT 'RECEITA',
    "tipo" VARCHAR(16) NOT NULL DEFAULT 'ANALITICA',
    "pai_id" TEXT,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cadastros_plano_contas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cadastros_tabelas_preco" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "nome" VARCHAR(255) NOT NULL,
    "descricao" TEXT,
    "cliente_id" TEXT,
    "moeda" VARCHAR(8) NOT NULL DEFAULT 'BRL',
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cadastros_tabelas_preco_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cadastros_tabelas_preco_itens" (
    "id" TEXT NOT NULL,
    "tabela_id" TEXT NOT NULL,
    "tipo_operacao_codigo" VARCHAR(32) NOT NULL,
    "tipo_container_codigo" VARCHAR(32),
    "container_tamanho" VARCHAR(8),
    "valor" DECIMAL(12,2) NOT NULL,
    "unidade" VARCHAR(32) NOT NULL DEFAULT 'POR_OPERACAO',
    "valor_minimo" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cadastros_tabelas_preco_itens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cadastros_bancos_tenant_id_codigo_key" ON "cadastros_bancos"("tenant_id", "codigo");
CREATE INDEX "cadastros_bancos_tenant_id_ativo_idx" ON "cadastros_bancos"("tenant_id", "ativo");

CREATE UNIQUE INDEX "cadastros_centros_custo_tenant_id_codigo_key" ON "cadastros_centros_custo"("tenant_id", "codigo");
CREATE INDEX "cadastros_centros_custo_tenant_id_tipo_ativo_idx" ON "cadastros_centros_custo"("tenant_id", "tipo", "ativo");
CREATE INDEX "cadastros_centros_custo_tenant_id_pai_id_idx" ON "cadastros_centros_custo"("tenant_id", "pai_id");

CREATE UNIQUE INDEX "cadastros_plano_contas_tenant_id_codigo_key" ON "cadastros_plano_contas"("tenant_id", "codigo");
CREATE INDEX "cadastros_plano_contas_tenant_id_tipo_ativo_idx" ON "cadastros_plano_contas"("tenant_id", "tipo", "ativo");
CREATE INDEX "cadastros_plano_contas_tenant_id_natureza_idx" ON "cadastros_plano_contas"("tenant_id", "natureza");

CREATE INDEX "cadastros_tabelas_preco_tenant_id_ativo_idx" ON "cadastros_tabelas_preco"("tenant_id", "ativo");
CREATE INDEX "cadastros_tabelas_preco_tenant_id_cliente_id_idx" ON "cadastros_tabelas_preco"("tenant_id", "cliente_id");
CREATE INDEX "cadastros_tabelas_preco_tenant_id_data_inicio_data_fim_idx" ON "cadastros_tabelas_preco"("tenant_id", "data_inicio", "data_fim");

CREATE INDEX "cadastros_tabelas_preco_itens_tabela_id_idx" ON "cadastros_tabelas_preco_itens"("tabela_id");
CREATE INDEX "cadastros_tabelas_preco_itens_tipo_operacao_codigo_tipo_container_codigo_idx" ON "cadastros_tabelas_preco_itens"("tipo_operacao_codigo", "tipo_container_codigo");

ALTER TABLE "cadastros_bancos" ADD CONSTRAINT "cadastros_bancos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cadastros_centros_custo" ADD CONSTRAINT "cadastros_centros_custo_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cadastros_centros_custo" ADD CONSTRAINT "cadastros_centros_custo_pai_id_fkey" FOREIGN KEY ("pai_id") REFERENCES "cadastros_centros_custo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cadastros_plano_contas" ADD CONSTRAINT "cadastros_plano_contas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cadastros_plano_contas" ADD CONSTRAINT "cadastros_plano_contas_pai_id_fkey" FOREIGN KEY ("pai_id") REFERENCES "cadastros_plano_contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cadastros_tabelas_preco" ADD CONSTRAINT "cadastros_tabelas_preco_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cadastros_tabelas_preco" ADD CONSTRAINT "cadastros_tabelas_preco_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cadastros_tabelas_preco_itens" ADD CONSTRAINT "cadastros_tabelas_preco_itens_tabela_id_fkey" FOREIGN KEY ("tabela_id") REFERENCES "cadastros_tabelas_preco"("id") ON DELETE CASCADE ON UPDATE CASCADE;
