-- Mobile Hub — telemetria (TTL 7d) + hub-ops auditoria (TTL 90d)

CREATE TABLE "mobile_telemetry" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "device_id" VARCHAR(128),
  "user_id" VARCHAR(64) NOT NULL,
  "mobile_role" VARCHAR(30),
  "canal" VARCHAR(30) NOT NULL,
  "lat" DOUBLE PRECISION,
  "lon" DOUBLE PRECISION,
  "network_strength" INTEGER,
  "latency_ms" INTEGER,
  "battery_pct" INTEGER,
  "errors" JSONB NOT NULL DEFAULT '[]',
  "offline_usage_sec" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mobile_telemetry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mobile_telemetry_user_id_created_at_idx" ON "mobile_telemetry"("user_id", "created_at" DESC);
CREATE INDEX "mobile_telemetry_tenant_id_idx" ON "mobile_telemetry"("tenant_id");
CREATE INDEX "mobile_telemetry_created_at_idx" ON "mobile_telemetry"("created_at");

CREATE TABLE "mobile_hub_ops" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "user_id" VARCHAR(64) NOT NULL,
  "canal" VARCHAR(30) NOT NULL,
  "acao" VARCHAR(120) NOT NULL,
  "payload" JSONB NOT NULL,
  "ip" VARCHAR(64),
  "user_agent" VARCHAR(1024),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mobile_hub_ops_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mobile_hub_ops_user_id_created_at_idx" ON "mobile_hub_ops"("user_id", "created_at" DESC);
CREATE INDEX "mobile_hub_ops_tenant_id_idx" ON "mobile_hub_ops"("tenant_id");
CREATE INDEX "mobile_hub_ops_created_at_idx" ON "mobile_hub_ops"("created_at");
