-- Catálogo físico da caixa, compartilhado entre tenants. Sem dados de cliente/operação.
CREATE TABLE "catalogo_containers_iso" (
    "id" TEXT NOT NULL,
    "unidade_iso" VARCHAR(16) NOT NULL,
    "tipo_iso" VARCHAR(8),
    "tipo_codigo" VARCHAR(32),
    "tamanho_pes" VARCHAR(8),
    "perfil" VARCHAR(16),
    "mgw_kg" INTEGER,
    "tara_kg" INTEGER,
    "payload_kg" INTEGER,
    "owner" VARCHAR(64),
    "origem" VARCHAR(32) NOT NULL DEFAULT 'GATE',
    "confirmado_em" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalogo_containers_iso_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "catalogo_containers_iso_unidade_iso_key" ON "catalogo_containers_iso"("unidade_iso");
CREATE INDEX "catalogo_containers_iso_tipo_codigo_tamanho_pes_idx" ON "catalogo_containers_iso"("tipo_codigo", "tamanho_pes");
