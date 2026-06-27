-- Motor de Faturamento — Armazenagem (Provisão + Fatura Gate-Out)

CREATE TYPE "StatusPreFatura" AS ENUM ('ABERTA', 'CONSOLIDADA');
CREATE TYPE "StatusPagamentoFatura" AS ENUM ('PENDENTE', 'PAGO', 'CANCELADO');

CREATE TABLE "tabelas_tarifarias" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "free_time_dias" INTEGER NOT NULL DEFAULT 5,
    "valor_diaria" DECIMAL(10,2) NOT NULL,
    "valor_servicos_extras" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tabelas_tarifarias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pre_faturas" (
    "id" TEXT NOT NULL,
    "container_iso" VARCHAR(16) NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "gate_in_id" TEXT NOT NULL,
    "gate_in_at" TIMESTAMP(3) NOT NULL,
    "valor_acumulado" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "dias_cobrados" INTEGER NOT NULL DEFAULT 0,
    "status" "StatusPreFatura" NOT NULL DEFAULT 'ABERTA',
    "cobranca_inicio_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pre_faturas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "faturas_armazenagem" (
    "id" TEXT NOT NULL,
    "pre_fatura_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "valor_total" DECIMAL(10,2) NOT NULL,
    "data_emissao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "link_nfse" VARCHAR(500),
    "status_pagamento" "StatusPagamentoFatura" NOT NULL DEFAULT 'PENDENTE',
    "faturamento_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faturas_armazenagem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tabelas_tarifarias_cliente_id_key" ON "tabelas_tarifarias"("cliente_id");
CREATE UNIQUE INDEX "pre_faturas_gate_in_id_container_iso_key" ON "pre_faturas"("gate_in_id", "container_iso");
CREATE INDEX "pre_faturas_cliente_id_status_idx" ON "pre_faturas"("cliente_id", "status");
CREATE INDEX "pre_faturas_container_iso_idx" ON "pre_faturas"("container_iso");
CREATE UNIQUE INDEX "faturas_armazenagem_pre_fatura_id_key" ON "faturas_armazenagem"("pre_fatura_id");
CREATE INDEX "faturas_armazenagem_cliente_id_idx" ON "faturas_armazenagem"("cliente_id");
CREATE INDEX "faturas_armazenagem_faturamento_id_idx" ON "faturas_armazenagem"("faturamento_id");

ALTER TABLE "tabelas_tarifarias" ADD CONSTRAINT "tabelas_tarifarias_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pre_faturas" ADD CONSTRAINT "pre_faturas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pre_faturas" ADD CONSTRAINT "pre_faturas_gate_in_id_fkey" FOREIGN KEY ("gate_in_id") REFERENCES "gate_v2_check_ins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "faturas_armazenagem" ADD CONSTRAINT "faturas_armazenagem_pre_fatura_id_fkey" FOREIGN KEY ("pre_fatura_id") REFERENCES "pre_faturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "faturas_armazenagem" ADD CONSTRAINT "faturas_armazenagem_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "faturas_armazenagem" ADD CONSTRAINT "faturas_armazenagem_faturamento_id_fkey" FOREIGN KEY ("faturamento_id") REFERENCES "faturamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
