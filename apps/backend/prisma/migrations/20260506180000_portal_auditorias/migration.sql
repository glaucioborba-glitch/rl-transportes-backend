-- CreateTable
CREATE TABLE "portal_auditorias" (
    "id" UUID NOT NULL,
    "cliente_id" TEXT,
    "usuario_portal_id" TEXT,
    "acao" VARCHAR(120) NOT NULL,
    "rota" VARCHAR(512) NOT NULL,
    "metodo_http" VARCHAR(16) NOT NULL,
    "payload_enviado" JSONB,
    "resultado" JSONB,
    "ip" VARCHAR(64) NOT NULL,
    "user_agent" VARCHAR(512) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_auditorias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portal_auditorias_cliente_id_idx" ON "portal_auditorias"("cliente_id");

-- CreateIndex
CREATE INDEX "portal_auditorias_usuario_portal_id_idx" ON "portal_auditorias"("usuario_portal_id");

-- CreateIndex
CREATE INDEX "portal_auditorias_data_idx" ON "portal_auditorias"("data");
