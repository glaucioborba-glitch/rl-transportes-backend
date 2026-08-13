-- H5: CX / Tenant config persistence (PostgreSQL source of truth)

CREATE TABLE "tenant_configs" (
    "id" TEXT NOT NULL,
    "tenant_key" VARCHAR(64) NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "cliente_ids" JSONB NOT NULL DEFAULT '[]',
    "slas_horas_proxy" JSONB NOT NULL,
    "horario_funcionamento" VARCHAR(64) NOT NULL,
    "regras_operacao" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_configs_tenant_key_key" ON "tenant_configs"("tenant_key");

CREATE TABLE "cx_portal_fornecedor_identities" (
    "id" TEXT NOT NULL,
    "cpf_cnpj" VARCHAR(14) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL,
    "papel" VARCHAR(32) NOT NULL,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cx_portal_fornecedor_identities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cx_portal_fornecedor_identities_cpf_cnpj_key" ON "cx_portal_fornecedor_identities"("cpf_cnpj");
CREATE INDEX "cx_portal_fornecedor_identities_tenant_id_idx" ON "cx_portal_fornecedor_identities"("tenant_id");

CREATE TABLE "cx_portal_branding_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL,
    "cores" JSONB NOT NULL,
    "logo_url" VARCHAR(500),
    "tema" VARCHAR(16) NOT NULL DEFAULT 'light',
    "menu_itens" JSONB NOT NULL DEFAULT '[]',
    "slas_exibidos" JSONB NOT NULL DEFAULT '[]',
    "kpis_exibidos" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cx_portal_branding_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cx_portal_branding_configs_tenant_id_key" ON "cx_portal_branding_configs"("tenant_id");

CREATE TABLE "cx_portal_tickets" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL,
    "autor_sub" VARCHAR(128) NOT NULL,
    "portal_papel" VARCHAR(32) NOT NULL,
    "assunto" VARCHAR(255) NOT NULL,
    "corpo" TEXT NOT NULL,
    "categoria" VARCHAR(32) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'aberto',
    "respostas" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cx_portal_tickets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cx_portal_tickets_tenant_id_created_at_idx" ON "cx_portal_tickets"("tenant_id", "created_at");
CREATE INDEX "cx_portal_tickets_autor_sub_idx" ON "cx_portal_tickets"("autor_sub");

CREATE TABLE "cx_portal_analytics_hits" (
    "id" TEXT NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "sub" VARCHAR(128) NOT NULL,
    "portal_papel" VARCHAR(32) NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL,
    "hit_at" TIMESTAMP(3) NOT NULL,
    "tempo_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cx_portal_analytics_hits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cx_portal_analytics_hits_hit_at_idx" ON "cx_portal_analytics_hits"("hit_at");
CREATE INDEX "cx_portal_analytics_hits_tenant_id_hit_at_idx" ON "cx_portal_analytics_hits"("tenant_id", "hit_at");

CREATE TABLE "cx_portal_marketplace_preferences" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL,
    "sub" VARCHAR(128) NOT NULL,
    "servicos" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cx_portal_marketplace_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cx_portal_marketplace_preferences_tenant_id_sub_key" ON "cx_portal_marketplace_preferences"("tenant_id", "sub");

CREATE TABLE "plataforma_api_clients" (
    "id" TEXT NOT NULL,
    "api_key" VARCHAR(128) NOT NULL,
    "secret" VARCHAR(255) NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL,
    "cliente_ids" JSONB NOT NULL DEFAULT '[]',
    "requests_per_minute" INTEGER NOT NULL DEFAULT 120,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "servicos_habilitados" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plataforma_api_clients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plataforma_api_clients_api_key_key" ON "plataforma_api_clients"("api_key");
CREATE INDEX "plataforma_api_clients_tenant_id_idx" ON "plataforma_api_clients"("tenant_id");
