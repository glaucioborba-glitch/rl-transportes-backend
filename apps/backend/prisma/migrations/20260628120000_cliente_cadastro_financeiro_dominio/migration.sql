-- CreateEnum
CREATE TYPE "ValidacaoDominio" AS ENUM ('APROVADO', 'DIVERGENTE', 'INDISPONIVEL');

-- CreateEnum
CREATE TYPE "StatusCadastroCliente" AS ENUM ('PENDENTE_ANALISE_FINANCEIRA', 'APROVADO', 'REJEITADO');

-- AlterTable
ALTER TABLE "clientes"
ADD COLUMN "validacao_dominio" "ValidacaoDominio" NOT NULL DEFAULT 'INDISPONIVEL',
ADD COLUMN "status_cadastro" "StatusCadastroCliente" NOT NULL DEFAULT 'PENDENTE_ANALISE_FINANCEIRA',
ADD COLUMN "condicao_pagamento" VARCHAR(64),
ADD COLUMN "analisado_por" VARCHAR(64),
ADD COLUMN "analisado_em" TIMESTAMP(3),
ADD COLUMN "motivo_rejeicao_cadastro" VARCHAR(500);

-- Backfill: clientes existentes (cadastro staff) liberados para operação
UPDATE "clientes"
SET "status_cadastro" = 'APROVADO'
WHERE "deletedAt" IS NULL;

-- CreateIndex
CREATE INDEX "clientes_status_cadastro_idx" ON "clientes"("status_cadastro");
