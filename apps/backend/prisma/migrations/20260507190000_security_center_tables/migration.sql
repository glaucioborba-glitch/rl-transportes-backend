-- Security Center + login telemetry
CREATE TABLE "security_alerts" (
    "id" TEXT NOT NULL,
    "user_id" VARCHAR(64),
    "cliente_id" VARCHAR(36),
    "risco" DECIMAL(6,2),
    "tipo" VARCHAR(96) NOT NULL,
    "ip" VARCHAR(64),
    "geo" JSONB,
    "fingerprint" VARCHAR(128),
    "rota" VARCHAR(512),
    "metodo" VARCHAR(16),
    "contexto" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "security_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "security_alerts_user_id_created_at_idx" ON "security_alerts"("user_id", "created_at" DESC);
CREATE INDEX "security_alerts_created_at_idx" ON "security_alerts"("created_at");

CREATE TABLE "login_attempts" (
    "id" TEXT NOT NULL,
    "user_id" VARCHAR(64),
    "documento" VARCHAR(14),
    "sucesso" BOOLEAN NOT NULL,
    "ip" VARCHAR(64),
    "geo" JSONB,
    "user_agent" VARCHAR(1024),
    "motivo" VARCHAR(255),
    "fingerprint" VARCHAR(128),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "login_attempts_created_at_idx" ON "login_attempts"("created_at" DESC);
CREATE INDEX "login_attempts_user_id_created_at_idx" ON "login_attempts"("user_id", "created_at" DESC);
CREATE INDEX "login_attempts_documento_created_at_idx" ON "login_attempts"("documento", "created_at" DESC);
