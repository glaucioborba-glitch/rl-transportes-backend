-- Terceiros (PF) contratados para transportes: motorista, dono e veículo.

CREATE TYPE "CapacidadeVeiculoTerceiro" AS ENUM ('PE_20', 'PE_40', 'AMBOS');

CREATE TABLE "cadastros_terceiros" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "motorista_nome" VARCHAR(255) NOT NULL,
    "motorista_cpf" VARCHAR(11) NOT NULL,
    "dono_nome" VARCHAR(255) NOT NULL,
    "pix" VARCHAR(128) NOT NULL,
    "placa_cavalo" VARCHAR(10) NOT NULL,
    "placa_carreta" VARCHAR(10),
    "capacidade" "CapacidadeVeiculoTerceiro" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cadastros_terceiros_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cadastros_terceiros_tenant_id_motorista_cpf_key" ON "cadastros_terceiros"("tenant_id", "motorista_cpf");
CREATE INDEX "cadastros_terceiros_tenant_id_ativo_idx" ON "cadastros_terceiros"("tenant_id", "ativo");

ALTER TABLE "cadastros_terceiros" ADD CONSTRAINT "cadastros_terceiros_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
