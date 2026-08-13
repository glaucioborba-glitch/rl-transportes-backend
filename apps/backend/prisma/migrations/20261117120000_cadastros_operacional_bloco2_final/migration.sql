-- Bloco 2 Operacional (final): posições pátio, tipos operação, turnos, motivos rejeição

CREATE TABLE "cadastros_posicoes_patio_zonas" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "codigo" VARCHAR(16) NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "cor" VARCHAR(16) NOT NULL DEFAULT '#3B82F6',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cadastros_posicoes_patio_zonas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cadastros_posicoes_patio_baias" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "zona_id" TEXT NOT NULL,
    "codigo" VARCHAR(32) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cadastros_posicoes_patio_baias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cadastros_posicoes_patio" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "zona_id" TEXT NOT NULL,
    "baia_id" TEXT NOT NULL,
    "codigo" VARCHAR(64) NOT NULL,
    "zona_codigo" VARCHAR(16) NOT NULL,
    "baia_codigo" VARCHAR(32) NOT NULL,
    "zona_nome" VARCHAR(120) NOT NULL,
    "zona_cor" VARCHAR(16) NOT NULL DEFAULT '#3B82F6',
    "slot_numero" INTEGER NOT NULL,
    "stack_altura" INTEGER NOT NULL DEFAULT 1,
    "tipo_aceito" VARCHAR(32) NOT NULL DEFAULT 'MISTO',
    "tomada_reefer" BOOLEAN NOT NULL DEFAULT false,
    "capacidade_peso" DECIMAL(8,2),
    "status" VARCHAR(32) NOT NULL DEFAULT 'LIVRE',
    "restricoes" TEXT,
    "container_atual" VARCHAR(11),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cadastros_posicoes_patio_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cadastros_tipos_operacao" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "codigo" VARCHAR(32) NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "descricao" TEXT,
    "direcao" VARCHAR(32) NOT NULL DEFAULT 'ENTRADA',
    "exige_container" BOOLEAN NOT NULL DEFAULT true,
    "exige_caminhao" BOOLEAN NOT NULL DEFAULT true,
    "exige_empilhadeira" BOOLEAN NOT NULL DEFAULT true,
    "tempo_padrao" INTEGER,
    "centro_custo_padrao" VARCHAR(32),
    "cor" VARCHAR(16) NOT NULL DEFAULT '#3B82F6',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cadastros_tipos_operacao_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cadastros_turnos" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "codigo" VARCHAR(16) NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "hora_inicio" VARCHAR(8) NOT NULL,
    "hora_fim" VARCHAR(8) NOT NULL,
    "capacidade_maxima" INTEGER,
    "dias_semana" JSONB NOT NULL DEFAULT '[]',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cadastros_turnos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cadastros_motivos_rejeicao" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "codigo" VARCHAR(64) NOT NULL,
    "descricao" VARCHAR(255) NOT NULL,
    "tipo" VARCHAR(32) NOT NULL DEFAULT 'REJEICAO_GATE',
    "exige_observacao" BOOLEAN NOT NULL DEFAULT false,
    "notifica_cliente" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cadastros_motivos_rejeicao_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cadastros_posicoes_patio_zonas_tenant_id_codigo_key" ON "cadastros_posicoes_patio_zonas"("tenant_id", "codigo");
CREATE UNIQUE INDEX "cadastros_posicoes_patio_baias_tenant_id_zona_id_codigo_key" ON "cadastros_posicoes_patio_baias"("tenant_id", "zona_id", "codigo");
CREATE UNIQUE INDEX "cadastros_posicoes_patio_tenant_id_codigo_key" ON "cadastros_posicoes_patio"("tenant_id", "codigo");
CREATE INDEX "cadastros_posicoes_patio_tenant_id_status_tipo_aceito_idx" ON "cadastros_posicoes_patio"("tenant_id", "status", "tipo_aceito");
CREATE UNIQUE INDEX "cadastros_tipos_operacao_tenant_id_codigo_key" ON "cadastros_tipos_operacao"("tenant_id", "codigo");
CREATE UNIQUE INDEX "cadastros_turnos_tenant_id_codigo_key" ON "cadastros_turnos"("tenant_id", "codigo");
CREATE UNIQUE INDEX "cadastros_motivos_rejeicao_tenant_id_codigo_key" ON "cadastros_motivos_rejeicao"("tenant_id", "codigo");
CREATE INDEX "cadastros_motivos_rejeicao_tenant_id_tipo_ativo_idx" ON "cadastros_motivos_rejeicao"("tenant_id", "tipo", "ativo");

ALTER TABLE "cadastros_posicoes_patio_zonas" ADD CONSTRAINT "cadastros_posicoes_patio_zonas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cadastros_posicoes_patio_baias" ADD CONSTRAINT "cadastros_posicoes_patio_baias_zona_id_fkey" FOREIGN KEY ("zona_id") REFERENCES "cadastros_posicoes_patio_zonas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cadastros_posicoes_patio" ADD CONSTRAINT "cadastros_posicoes_patio_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cadastros_posicoes_patio" ADD CONSTRAINT "cadastros_posicoes_patio_zona_id_fkey" FOREIGN KEY ("zona_id") REFERENCES "cadastros_posicoes_patio_zonas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cadastros_posicoes_patio" ADD CONSTRAINT "cadastros_posicoes_patio_baia_id_fkey" FOREIGN KEY ("baia_id") REFERENCES "cadastros_posicoes_patio_baias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cadastros_tipos_operacao" ADD CONSTRAINT "cadastros_tipos_operacao_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cadastros_turnos" ADD CONSTRAINT "cadastros_turnos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cadastros_motivos_rejeicao" ADD CONSTRAINT "cadastros_motivos_rejeicao_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
