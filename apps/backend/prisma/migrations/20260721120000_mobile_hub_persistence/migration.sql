-- Mobile Hub — persistência PostgreSQL (E2 #2)

CREATE TABLE "mobile_device_bindings" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "device_id" VARCHAR(128) NOT NULL,
  "user_sub" VARCHAR(128) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mobile_device_bindings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "mobile_device_bindings_device_id_key" ON "mobile_device_bindings"("device_id");
CREATE INDEX "mobile_device_bindings_user_sub_idx" ON "mobile_device_bindings"("user_sub");

CREATE TABLE "mobile_motorista_identities" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "cpf_cnpj" VARCHAR(14) NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "protocolo_padrao" VARCHAR(64) NOT NULL,
  "token_version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mobile_motorista_identities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "mobile_motorista_identities_cpf_cnpj_key" ON "mobile_motorista_identities"("cpf_cnpj");

CREATE TABLE "mobile_offline_events" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "device_id" VARCHAR(128) NOT NULL,
  "user_sub" VARCHAR(128) NOT NULL,
  "op" VARCHAR(32) NOT NULL,
  "body" JSONB NOT NULL,
  "client_ts" BIGINT NOT NULL,
  "recebido_em" TIMESTAMP(3) NOT NULL,
  "synced" BOOLEAN NOT NULL DEFAULT false,
  "conflict_resolved" VARCHAR(64),
  CONSTRAINT "mobile_offline_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "mobile_offline_events_device_id_synced_idx" ON "mobile_offline_events"("device_id", "synced");

CREATE TABLE "mobile_fcm_tokens" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "user_sub" VARCHAR(128) NOT NULL,
  "token" VARCHAR(512) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mobile_fcm_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "mobile_fcm_tokens_user_sub_key" ON "mobile_fcm_tokens"("user_sub");

CREATE TABLE "mobile_push_jobs" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "tipo" VARCHAR(32) NOT NULL,
  "destino_sub" VARCHAR(128),
  "device_id" VARCHAR(128),
  "titulo" VARCHAR(255) NOT NULL,
  "corpo" TEXT NOT NULL,
  "meta" JSONB,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "entregue_em" TIMESTAMP(3),
  CONSTRAINT "mobile_push_jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "mobile_push_jobs_destino_sub_entregue_em_idx" ON "mobile_push_jobs"("destino_sub", "entregue_em");

CREATE TABLE "mobile_pin_lockouts" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "device_id" VARCHAR(128) NOT NULL,
  "falhas_json" JSONB NOT NULL DEFAULT '[]',
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mobile_pin_lockouts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "mobile_pin_lockouts_device_id_key" ON "mobile_pin_lockouts"("device_id");
