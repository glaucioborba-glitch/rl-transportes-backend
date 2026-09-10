CREATE TYPE "ModalidadeUnidadeProcesso" AS ENUM ('PATIO', 'ALUGUEL');
CREATE TYPE "StatusUnidadeAluguel" AS ENUM ('DISPONIVEL', 'ALUGADA', 'MANUTENCAO', 'INATIVA');
CREATE TYPE "StatusAluguel" AS ENUM ('ATIVO', 'ENCERRADO', 'CANCELADO');

ALTER TABLE "unidade_processos"
  ADD COLUMN IF NOT EXISTS "modalidade" "ModalidadeUnidadeProcesso" NOT NULL DEFAULT 'PATIO';

ALTER TABLE "unidade_processos"
  ALTER COLUMN "entrada_solicitacao_id" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "unidade_processos_modalidade_status_idx"
  ON "unidade_processos" ("modalidade", "status");

CREATE TABLE IF NOT EXISTS "cadastros_unidades_aluguel" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "unidade_iso" VARCHAR(16) NOT NULL,
  "tipo_container_codigo" VARCHAR(32) NOT NULL,
  "container_tamanho" VARCHAR(8) NOT NULL,
  "capacidade_codigo" VARCHAR(32),
  "status" "StatusUnidadeAluguel" NOT NULL DEFAULT 'DISPONIVEL',
  "observacao" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "cadastros_unidades_aluguel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cadastros_unidades_aluguel_tenant_id_unidade_iso_key"
  ON "cadastros_unidades_aluguel" ("tenant_id", "unidade_iso");
CREATE INDEX IF NOT EXISTS "cadastros_unidades_aluguel_tenant_id_status_idx"
  ON "cadastros_unidades_aluguel" ("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "cadastros_tabelas_aluguel" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "nome" VARCHAR(255) NOT NULL,
  "descricao" TEXT,
  "data_inicio" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "data_fim" DATE,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "padrao" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "cadastros_tabelas_aluguel_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cadastros_tabelas_aluguel_tenant_id_ativo_idx"
  ON "cadastros_tabelas_aluguel" ("tenant_id", "ativo");
CREATE INDEX IF NOT EXISTS "cadastros_tabelas_aluguel_tenant_id_padrao_idx"
  ON "cadastros_tabelas_aluguel" ("tenant_id", "padrao");

CREATE TABLE IF NOT EXISTS "cadastros_tabela_aluguel_itens" (
  "id" TEXT NOT NULL,
  "tabela_id" TEXT NOT NULL,
  "tipo_container_codigo" VARCHAR(32) NOT NULL,
  "container_tamanho" VARCHAR(8) NOT NULL,
  "valor_diaria" DECIMAL(12, 2) NOT NULL,
  "dias_free_time" INTEGER NOT NULL DEFAULT 0,
  "valor_entrega" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "valor_coleta" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "cadastros_tabela_aluguel_itens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cadastros_tabela_aluguel_itens_tabela_tipo_tam_key"
  ON "cadastros_tabela_aluguel_itens" ("tabela_id", "tipo_container_codigo", "container_tamanho");
CREATE INDEX IF NOT EXISTS "cadastros_tabela_aluguel_itens_tabela_id_ativo_idx"
  ON "cadastros_tabela_aluguel_itens" ("tabela_id", "ativo");

CREATE TABLE IF NOT EXISTS "alugueis" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "unidade_aluguel_id" TEXT NOT NULL,
  "cliente_id" TEXT NOT NULL,
  "tabela_aluguel_id" TEXT NOT NULL,
  "unidade_processo_id" TEXT NOT NULL,
  "status" "StatusAluguel" NOT NULL DEFAULT 'ATIVO',
  "iniciado_em" TIMESTAMP(3) NOT NULL,
  "encerrado_em" TIMESTAMP(3),
  "observacao" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "alugueis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "alugueis_unidade_processo_id_key" ON "alugueis" ("unidade_processo_id");
CREATE INDEX IF NOT EXISTS "alugueis_tenant_id_status_idx" ON "alugueis" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "alugueis_cliente_id_status_idx" ON "alugueis" ("cliente_id", "status");
CREATE INDEX IF NOT EXISTS "alugueis_unidade_aluguel_id_status_idx" ON "alugueis" ("unidade_aluguel_id", "status");

ALTER TABLE "cadastros_unidades_aluguel"
  ADD CONSTRAINT "cadastros_unidades_aluguel_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cadastros_tabelas_aluguel"
  ADD CONSTRAINT "cadastros_tabelas_aluguel_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cadastros_tabela_aluguel_itens"
  ADD CONSTRAINT "cadastros_tabela_aluguel_itens_tabela_id_fkey"
  FOREIGN KEY ("tabela_id") REFERENCES "cadastros_tabelas_aluguel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "alugueis"
  ADD CONSTRAINT "alugueis_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "alugueis"
  ADD CONSTRAINT "alugueis_unidade_aluguel_id_fkey"
  FOREIGN KEY ("unidade_aluguel_id") REFERENCES "cadastros_unidades_aluguel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "alugueis"
  ADD CONSTRAINT "alugueis_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "alugueis"
  ADD CONSTRAINT "alugueis_tabela_aluguel_id_fkey"
  FOREIGN KEY ("tabela_aluguel_id") REFERENCES "cadastros_tabelas_aluguel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "alugueis"
  ADD CONSTRAINT "alugueis_unidade_processo_id_fkey"
  FOREIGN KEY ("unidade_processo_id") REFERENCES "unidade_processos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
