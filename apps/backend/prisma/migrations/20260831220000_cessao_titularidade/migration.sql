-- Cessão de titularidade do ID + segmentos de pré-fatura (mesmo ISO, vários pagadores).

CREATE TYPE "EtapaCessaoTitularidade" AS ENUM ('DURANTE_ESTADIA', 'POS_SAIDA', 'POS_NFSE');
CREATE TYPE "StatusCessaoTitularidade" AS ENUM ('CONCLUIDA', 'AGUARDANDO_CANCELAMENTO_NFSE', 'REEMITIDA', 'CANCELADA');

ALTER TABLE "pre_faturas" ADD COLUMN IF NOT EXISTS "segmento" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "pre_faturas" ADD COLUMN IF NOT EXISTS "cessao_id" TEXT;
ALTER TABLE "pre_faturas" ADD COLUMN IF NOT EXISTS "free_time_zerado" BOOLEAN NOT NULL DEFAULT false;

DROP INDEX IF EXISTS "pre_faturas_unidade_processo_id_container_iso_key";
CREATE UNIQUE INDEX IF NOT EXISTS "pre_faturas_unidade_processo_id_container_iso_segmento_key"
  ON "pre_faturas"("unidade_processo_id", "container_iso", "segmento");

CREATE TABLE "cessoes_titularidade" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "unidade_processo_id" TEXT NOT NULL,
    "de_cliente_id" TEXT NOT NULL,
    "para_cliente_id" TEXT NOT NULL,
    "etapa" "EtapaCessaoTitularidade" NOT NULL,
    "status" "StatusCessaoTitularidade" NOT NULL,
    "motivo" VARCHAR(2000) NOT NULL,
    "reset_free_time" BOOLEAN NOT NULL DEFAULT false,
    "vigente_em" TIMESTAMP(3) NOT NULL,
    "gerente_id" TEXT NOT NULL,
    "operador_id" TEXT NOT NULL,
    "pre_fatura_origem_id" TEXT,
    "pre_fatura_destino_id" TEXT,
    "fatura_origem_id" TEXT,
    "fatura_destino_id" TEXT,
    "valor_origem" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cessoes_titularidade_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cessoes_titularidade_unidade_processo_id_created_at_idx"
  ON "cessoes_titularidade"("unidade_processo_id", "created_at");
CREATE INDEX "cessoes_titularidade_para_cliente_id_idx"
  ON "cessoes_titularidade"("para_cliente_id");
CREATE INDEX "cessoes_titularidade_status_etapa_idx"
  ON "cessoes_titularidade"("status", "etapa");
CREATE INDEX "cessoes_titularidade_tenant_id_idx"
  ON "cessoes_titularidade"("tenant_id");

ALTER TABLE "cessoes_titularidade"
  ADD CONSTRAINT "cessoes_titularidade_unidade_processo_id_fkey"
  FOREIGN KEY ("unidade_processo_id") REFERENCES "unidade_processos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cessoes_titularidade"
  ADD CONSTRAINT "cessoes_titularidade_de_cliente_id_fkey"
  FOREIGN KEY ("de_cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cessoes_titularidade"
  ADD CONSTRAINT "cessoes_titularidade_para_cliente_id_fkey"
  FOREIGN KEY ("para_cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
