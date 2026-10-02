-- Última posição GPS dos motoristas internos e terceiros (frota RL).
CREATE TYPE "MotoristaGpsOrigem" AS ENUM ('INTERNO', 'TERCEIRO');

CREATE TABLE "motorista_posicoes" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "origem" "MotoristaGpsOrigem" NOT NULL,
    "cadastro_id" VARCHAR(36) NOT NULL,
    "cpf" VARCHAR(11) NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "placa_cavalo" VARCHAR(10),
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "precisao_m" DOUBLE PRECISION,
    "rastreando" BOOLEAN NOT NULL DEFAULT true,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "motorista_posicoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "motorista_posicoes_tenant_id_origem_cadastro_id_key"
  ON "motorista_posicoes"("tenant_id", "origem", "cadastro_id");

CREATE INDEX "motorista_posicoes_tenant_id_atualizado_em_idx"
  ON "motorista_posicoes"("tenant_id", "atualizado_em");
