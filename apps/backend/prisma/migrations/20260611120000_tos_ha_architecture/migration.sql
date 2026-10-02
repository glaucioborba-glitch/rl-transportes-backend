-- TOS HA: OCC (version), PilhaLogica, Outbox, PRE_MOUNTING_DONE
ALTER TYPE "ContainerEventType" ADD VALUE IF NOT EXISTS 'PRE_MOUNTING_DONE';

CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

ALTER TABLE "containers_tos" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "pilhas_logicas" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(32) NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "patio_posicao_id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pilhas_logicas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "aggregate_type" VARCHAR(64) NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "event_type" VARCHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "error_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pilhas_logicas_patio_posicao_id_key" ON "pilhas_logicas"("patio_posicao_id");
CREATE UNIQUE INDEX "pilhas_logicas_cliente_id_codigo_key" ON "pilhas_logicas"("cliente_id", "codigo");
CREATE INDEX "pilhas_logicas_cliente_id_idx" ON "pilhas_logicas"("cliente_id");
CREATE INDEX "outbox_events_status_created_at_idx" ON "outbox_events"("status", "created_at");

ALTER TABLE "pilhas_logicas" ADD CONSTRAINT "pilhas_logicas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pilhas_logicas" ADD CONSTRAINT "pilhas_logicas_patio_posicao_id_fkey" FOREIGN KEY ("patio_posicao_id") REFERENCES "patio_v2_posicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
