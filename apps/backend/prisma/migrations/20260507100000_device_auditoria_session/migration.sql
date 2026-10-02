-- CreateTable
CREATE TABLE "device_auditorias" (
    "id" TEXT NOT NULL,
    "user_id" VARCHAR(64) NOT NULL,
    "cliente_id" VARCHAR(36),
    "fingerprint" VARCHAR(128) NOT NULL,
    "ip" VARCHAR(64) NOT NULL,
    "geoloc" TEXT,
    "user_agent" VARCHAR(1024) NOT NULL,
    "device_type" VARCHAR(32),
    "rota" VARCHAR(512) NOT NULL,
    "metodo" VARCHAR(16) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_auditorias_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "device_auditorias_user_id_timestamp_idx" ON "device_auditorias"("user_id", "timestamp" DESC);
CREATE INDEX "device_auditorias_timestamp_idx" ON "device_auditorias"("timestamp");
