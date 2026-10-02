-- Hold/Release Engine — BloqueioContainer

CREATE TYPE "TipoBloqueioContainer" AS ENUM ('FINANCEIRO', 'FISCAL', 'AVARIA', 'JUDICIAL', 'OPERACIONAL');
CREATE TYPE "StatusBloqueioContainer" AS ENUM ('ATIVO', 'LIBERADO');

CREATE TABLE "bloqueios_container" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "solicitacao_id" TEXT NOT NULL,
    "tipo" "TipoBloqueioContainer" NOT NULL,
    "motivo" VARCHAR(500) NOT NULL,
    "status" "StatusBloqueioContainer" NOT NULL DEFAULT 'ATIVO',
    "bloqueado_por_id" VARCHAR(64) NOT NULL,
    "data_bloqueio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liberado_por_id" VARCHAR(64),
    "data_liberacao" TIMESTAMP(3),
    "referencia_id" VARCHAR(64),

    CONSTRAINT "bloqueios_container_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bloqueios_container_solicitacao_id_status_idx" ON "bloqueios_container"("solicitacao_id", "status");
CREATE INDEX "bloqueios_container_tenant_id_status_idx" ON "bloqueios_container"("tenant_id", "status");
CREATE INDEX "bloqueios_container_tipo_status_idx" ON "bloqueios_container"("tipo", "status");

ALTER TABLE "bloqueios_container" ADD CONSTRAINT "bloqueios_container_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bloqueios_container" ADD CONSTRAINT "bloqueios_container_solicitacao_id_fkey" FOREIGN KEY ("solicitacao_id") REFERENCES "solicitacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
