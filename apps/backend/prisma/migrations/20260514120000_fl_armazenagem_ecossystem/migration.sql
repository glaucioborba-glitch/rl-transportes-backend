-- FL Armazenagem × ecossistema RL: workflow estendido, agendamentos por turno, bloqueio de movimentação, portaria compliance.

-- CreateEnum
CREATE TYPE "TipoFluxoLogistico" AS ENUM ('COLETA_CONTAINER', 'ENTREGA_BAIXA', 'EXPORTACAO', 'IMPORTACAO', 'SERVICO_ADICIONAL');

-- CreateEnum
CREATE TYPE "TurnoAgendamento" AS ENUM ('MANHA', 'TARDE');

-- CreateEnum
CREATE TYPE "StatusAgendamentoTerminal" AS ENUM ('PENDENTE', 'CONFIRMADO', 'CANCELADO');

-- AlterEnum (valores novos ao final — ordem Prisma)
ALTER TYPE "StatusSolicitacao" ADD VALUE 'EM_ANALISE';
ALTER TYPE "StatusSolicitacao" ADD VALUE 'EM_EXECUCAO';

-- AlterTable
ALTER TABLE "solicitacoes" ADD COLUMN "tipoFluxo" "TipoFluxoLogistico",
ADD COLUMN "servicosAdicionais" JSONB;

-- AlterTable
ALTER TABLE "unidades_solicitacao" ADD COLUMN "movimentacao_bloqueada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "bloqueio_motivo" VARCHAR(500),
ADD COLUMN "bloqueio_tipo" VARCHAR(64);

-- AlterTable
ALTER TABLE "portarias" ADD COLUMN "motorista_nome" VARCHAR(255),
ADD COLUMN "motorista_cpf" VARCHAR(11),
ADD COLUMN "transportadora_nome" VARCHAR(255),
ADD COLUMN "motorista_telefone" VARCHAR(20);

-- CreateTable
CREATE TABLE "agendamentos_terminal" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "solicitacaoId" TEXT,
    "numero_iso" VARCHAR(11) NOT NULL,
    "data_ref" DATE NOT NULL,
    "turno" "TurnoAgendamento" NOT NULL,
    "status" "StatusAgendamentoTerminal" NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agendamentos_terminal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capacidade_turno_terminal" (
    "id" TEXT NOT NULL,
    "turno" "TurnoAgendamento" NOT NULL,
    "limite_containers" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capacidade_turno_terminal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agendamentos_terminal_data_ref_turno_numero_iso_key" ON "agendamentos_terminal"("data_ref", "turno", "numero_iso");

-- CreateIndex
CREATE INDEX "agendamentos_terminal_clienteId_data_ref_idx" ON "agendamentos_terminal"("clienteId", "data_ref");

-- CreateIndex
CREATE INDEX "agendamentos_terminal_data_ref_turno_status_idx" ON "agendamentos_terminal"("data_ref", "turno", "status");

-- CreateIndex
CREATE UNIQUE INDEX "capacidade_turno_terminal_turno_key" ON "capacidade_turno_terminal"("turno");

-- AddForeignKey
ALTER TABLE "agendamentos_terminal" ADD CONSTRAINT "agendamentos_terminal_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos_terminal" ADD CONSTRAINT "agendamentos_terminal_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "solicitacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
