-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'GERENTE', 'OPERADOR_PORTARIA', 'OPERADOR_GATE', 'OPERADOR_PATIO', 'CLIENTE');

-- CreateEnum
CREATE TYPE "TipoCliente" AS ENUM ('PJ', 'PF');

-- CreateEnum
CREATE TYPE "StatusSolicitacao" AS ENUM ('PENDENTE', 'APROVADO', 'CONCLUIDO', 'REJEITADO');

-- CreateEnum
CREATE TYPE "TipoUnidade" AS ENUM ('IMPORT', 'EXPORT', 'GATE_IN', 'GATE_OUT');

-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM ('PENDENTE', 'PAGO', 'VENCIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusIpm" AS ENUM ('PENDENTE', 'ENVIADO', 'ACEITO', 'REJEITADO');

-- CreateEnum
CREATE TYPE "AcaoAuditoria" AS ENUM ('INSERT', 'UPDATE', 'DELETE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "tipo" "TipoCliente" NOT NULL,
    "cpfCnpj" VARCHAR(14) NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitacoes" (
    "id" TEXT NOT NULL,
    "protocolo" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "status" "StatusSolicitacao" NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades_solicitacao" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "numeroIso" TEXT NOT NULL,
    "tipo" "TipoUnidade" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unidades_solicitacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditorias" (
    "id" TEXT NOT NULL,
    "tabela" TEXT NOT NULL,
    "registroId" TEXT NOT NULL,
    "acao" "AcaoAuditoria" NOT NULL,
    "usuario" TEXT NOT NULL,
    "dadosAntes" JSONB,
    "dadosDepois" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portarias" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "fotosCaminhao" JSONB,
    "fotosContainer" JSONB,
    "fotosLacre" JSONB,
    "fotosAvarias" JSONB,
    "statusOcr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gates" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "ricAssinado" TEXT,
    "assinaturaBinaria" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patios" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "quadra" TEXT NOT NULL,
    "fileira" TEXT NOT NULL,
    "posicao" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saidas" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "dataHoraSaida" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saidas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faturamentos" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "valorTotal" DECIMAL(10,2) NOT NULL,
    "statusNfe" TEXT,
    "statusBoleto" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faturamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfs_emitidas" (
    "id" TEXT NOT NULL,
    "faturamentoId" TEXT NOT NULL,
    "numeroNfe" TEXT NOT NULL,
    "xmlNfe" TEXT,
    "statusIpm" "StatusIpm" NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nfs_emitidas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boletos" (
    "id" TEXT NOT NULL,
    "faturamentoId" TEXT NOT NULL,
    "numeroBoleto" TEXT NOT NULL,
    "dataVencimento" TIMESTAMP(3) NOT NULL,
    "valorBoleto" DECIMAL(10,2) NOT NULL,
    "statusPagamento" "StatusPagamento" NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boletos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_cpfCnpj_key" ON "clientes"("cpfCnpj");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_email_key" ON "clientes"("email");

-- CreateIndex
CREATE UNIQUE INDEX "solicitacoes_protocolo_key" ON "solicitacoes"("protocolo");

-- CreateIndex
CREATE INDEX "solicitacoes_clienteId_idx" ON "solicitacoes"("clienteId");

-- CreateIndex
CREATE INDEX "unidades_solicitacao_solicitacaoId_idx" ON "unidades_solicitacao"("solicitacaoId");

-- CreateIndex
CREATE INDEX "auditorias_tabela_registroId_idx" ON "auditorias"("tabela", "registroId");

-- CreateIndex
CREATE UNIQUE INDEX "portarias_solicitacaoId_key" ON "portarias"("solicitacaoId");

-- CreateIndex
CREATE INDEX "portarias_solicitacaoId_idx" ON "portarias"("solicitacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "gates_solicitacaoId_key" ON "gates"("solicitacaoId");

-- CreateIndex
CREATE INDEX "gates_solicitacaoId_idx" ON "gates"("solicitacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "patios_solicitacaoId_key" ON "patios"("solicitacaoId");

-- CreateIndex
CREATE INDEX "patios_solicitacaoId_idx" ON "patios"("solicitacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "saidas_solicitacaoId_key" ON "saidas"("solicitacaoId");

-- CreateIndex
CREATE INDEX "saidas_solicitacaoId_idx" ON "saidas"("solicitacaoId");

-- CreateIndex
CREATE INDEX "faturamentos_clienteId_idx" ON "faturamentos"("clienteId");

-- CreateIndex
CREATE INDEX "nfs_emitidas_faturamentoId_idx" ON "nfs_emitidas"("faturamentoId");

-- CreateIndex
CREATE INDEX "boletos_faturamentoId_idx" ON "boletos"("faturamentoId");

-- AddForeignKey
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades_solicitacao" ADD CONSTRAINT "unidades_solicitacao_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "solicitacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias" ADD CONSTRAINT "auditorias_usuario_fkey" FOREIGN KEY ("usuario") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portarias" ADD CONSTRAINT "portarias_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "solicitacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gates" ADD CONSTRAINT "gates_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "solicitacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patios" ADD CONSTRAINT "patios_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "solicitacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saidas" ADD CONSTRAINT "saidas_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "solicitacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faturamentos" ADD CONSTRAINT "faturamentos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfs_emitidas" ADD CONSTRAINT "nfs_emitidas_faturamentoId_fkey" FOREIGN KEY ("faturamentoId") REFERENCES "faturamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_faturamentoId_fkey" FOREIGN KEY ("faturamentoId") REFERENCES "faturamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
