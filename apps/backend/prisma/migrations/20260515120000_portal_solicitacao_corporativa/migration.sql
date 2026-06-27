-- Portal solicitação corporativa: transporte LS/Rodotrem, containers, agendamento, contato, anexos, cancelamento.

-- AlterEnum
ALTER TYPE "StatusSolicitacao" ADD VALUE 'CANCELADO';

-- CreateEnum
CREATE TYPE "TipoCaminhao" AS ENUM ('LS', 'RODOTREM');

-- CreateEnum
CREATE TYPE "StatusContainerForm" AS ENUM ('CHEIO', 'VAZIO');

-- CreateTable
CREATE TABLE "transporte_solicitacao" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "nome_motorista" VARCHAR(255) NOT NULL,
    "cpf_motorista" VARCHAR(11) NOT NULL,
    "tipo_caminhao" "TipoCaminhao" NOT NULL,
    "placa_cavalo" VARCHAR(10) NOT NULL,
    "placa_carreta_01" VARCHAR(10) NOT NULL,
    "placa_carreta_02" VARCHAR(10),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transporte_solicitacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "containers_solicitacao" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "unidade" VARCHAR(64) NOT NULL,
    "booking" VARCHAR(120) NOT NULL,
    "processo" VARCHAR(120) NOT NULL,
    "tamanho" VARCHAR(32) NOT NULL,
    "tipo" VARCHAR(64) NOT NULL,
    "status_container" "StatusContainerForm" NOT NULL,
    "lacre" VARCHAR(120),
    "refrigerado" BOOLEAN NOT NULL DEFAULT false,
    "set_point" DOUBLE PRECISION,
    "reefer_id" VARCHAR(64),
    "ordem" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "containers_solicitacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agendamentos_solicitacao" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "data_ref" DATE NOT NULL,
    "turno" "TurnoAgendamento" NOT NULL,
    "atendimento_especial" BOOLEAN NOT NULL DEFAULT false,
    "atendimento_especial_texto" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agendamentos_solicitacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitante_contato" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "telefone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitante_contato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitacao_anexos" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "url_s3" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitacao_anexos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transporte_solicitacao_solicitacaoId_key" ON "transporte_solicitacao"("solicitacaoId");

-- CreateIndex
CREATE INDEX "containers_solicitacao_solicitacaoId_idx" ON "containers_solicitacao"("solicitacaoId");

-- CreateIndex
CREATE INDEX "containers_solicitacao_booking_idx" ON "containers_solicitacao"("booking");

-- CreateIndex
CREATE UNIQUE INDEX "containers_solicitacao_solicitacaoId_ordem_key" ON "containers_solicitacao"("solicitacaoId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "agendamentos_solicitacao_solicitacaoId_key" ON "agendamentos_solicitacao"("solicitacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "solicitante_contato_solicitacaoId_key" ON "solicitante_contato"("solicitacaoId");

-- CreateIndex
CREATE INDEX "solicitacao_anexos_solicitacaoId_idx" ON "solicitacao_anexos"("solicitacaoId");

-- CreateIndex
CREATE INDEX "solicitacao_anexos_expires_at_idx" ON "solicitacao_anexos"("expires_at");

-- AddForeignKey
ALTER TABLE "transporte_solicitacao" ADD CONSTRAINT "transporte_solicitacao_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "solicitacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "containers_solicitacao" ADD CONSTRAINT "containers_solicitacao_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "solicitacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agendamentos_solicitacao" ADD CONSTRAINT "agendamentos_solicitacao_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "solicitacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "solicitante_contato" ADD CONSTRAINT "solicitante_contato_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "solicitacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "solicitacao_anexos" ADD CONSTRAINT "solicitacao_anexos_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "solicitacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
