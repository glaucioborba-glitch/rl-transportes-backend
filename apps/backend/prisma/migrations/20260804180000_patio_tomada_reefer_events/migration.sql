-- Tomada reefer: desplug TOS + histórico comercial no pátio v2
ALTER TYPE "ContainerEventType" ADD VALUE IF NOT EXISTS 'REEFER_UNPLUGGED';

DO $$ BEGIN
  CREATE TYPE "PatioTomadaEventType" AS ENUM ('SOLICITADO', 'CONECTADO', 'DESCONECTADO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "patio_v2_tomada_eventos" (
    "id" TEXT NOT NULL,
    "patio_unidade_id" TEXT NOT NULL,
    "tipo" "PatioTomadaEventType" NOT NULL,
    "set_point" DOUBLE PRECISION,
    "actor_user_id" TEXT,
    "observacao" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "patio_v2_tomada_eventos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "patio_v2_tomada_eventos_patio_unidade_id_created_at_idx"
  ON "patio_v2_tomada_eventos"("patio_unidade_id", "created_at");
CREATE INDEX IF NOT EXISTS "patio_v2_tomada_eventos_tipo_idx"
  ON "patio_v2_tomada_eventos"("tipo");

DO $$ BEGIN
  ALTER TABLE "patio_v2_tomada_eventos"
    ADD CONSTRAINT "patio_v2_tomada_eventos_patio_unidade_id_fkey"
    FOREIGN KEY ("patio_unidade_id") REFERENCES "patio_v2_unidades"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
