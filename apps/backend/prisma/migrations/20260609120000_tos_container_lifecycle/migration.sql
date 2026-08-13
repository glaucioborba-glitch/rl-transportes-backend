-- TOS: Container Lifecycle (Event Sourcing + FSM)

CREATE TYPE "TipoContainerTos" AS ENUM ('DRY', 'REEFER', 'TANK');

CREATE TYPE "ContainerEventType" AS ENUM (
  'SCHEDULED',
  'GATE_IN_OCR_FAILED',
  'GATE_IN_COMPLETED',
  'YARD_ALLOCATED',
  'REEFER_PLUGGED',
  'REEFER_TEMP_LOGGED',
  'REPAIR_REQUESTED',
  'REPAIR_APPROVED',
  'GATE_OUT_COMPLETED'
);

CREATE TYPE "MomentoAvaria" AS ENUM ('GATE_IN', 'GATE_OUT');

CREATE TABLE "containers_tos" (
  "id" TEXT NOT NULL,
  "numero" VARCHAR(11) NOT NULL,
  "tipo" "TipoContainerTos" NOT NULL,
  "cliente_id" TEXT NOT NULL,
  "agendamento_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "containers_tos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "container_events" (
  "id" TEXT NOT NULL,
  "container_id" TEXT NOT NULL,
  "event_type" "ContainerEventType" NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "criado_por" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "container_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "avaria_records" (
  "id" TEXT NOT NULL,
  "container_id" TEXT NOT NULL,
  "descricao" VARCHAR(1000) NOT NULL,
  "fotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "momento" "MomentoAvaria" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "avaria_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "containers_tos_numero_key" ON "containers_tos"("numero");
CREATE INDEX "containers_tos_cliente_id_idx" ON "containers_tos"("cliente_id");
CREATE INDEX "containers_tos_agendamento_id_idx" ON "containers_tos"("agendamento_id");

CREATE INDEX "container_events_container_id_created_at_idx" ON "container_events"("container_id", "created_at");
CREATE INDEX "container_events_event_type_idx" ON "container_events"("event_type");

CREATE INDEX "avaria_records_container_id_idx" ON "avaria_records"("container_id");

ALTER TABLE "containers_tos" ADD CONSTRAINT "containers_tos_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "containers_tos" ADD CONSTRAINT "containers_tos_agendamento_id_fkey"
  FOREIGN KEY ("agendamento_id") REFERENCES "agendamentos_terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "container_events" ADD CONSTRAINT "container_events_container_id_fkey"
  FOREIGN KEY ("container_id") REFERENCES "containers_tos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "container_events" ADD CONSTRAINT "container_events_criado_por_fkey"
  FOREIGN KEY ("criado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "avaria_records" ADD CONSTRAINT "avaria_records_container_id_fkey"
  FOREIGN KEY ("container_id") REFERENCES "containers_tos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
