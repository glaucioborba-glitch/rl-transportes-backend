-- Portal: usuário vinculado a cliente (1:1 opcional pelo lado User)
ALTER TABLE "users" ADD COLUMN "clienteId" TEXT;
CREATE UNIQUE INDEX "users_clienteId_key" ON "users"("clienteId");
CREATE INDEX "users_clienteId_idx" ON "users"("clienteId");
ALTER TABLE "users" ADD CONSTRAINT "users_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Faturamento agrupado com vínculo a solicitações operacionais
CREATE TABLE "faturamento_solicitacoes" (
    "id" TEXT NOT NULL,
    "faturamentoId" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "faturamento_solicitacoes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "faturamento_solicitacoes_faturamentoId_solicitacaoId_key" ON "faturamento_solicitacoes"("faturamentoId", "solicitacaoId");
CREATE INDEX "faturamento_solicitacoes_solicitacaoId_idx" ON "faturamento_solicitacoes"("solicitacaoId");
ALTER TABLE "faturamento_solicitacoes" ADD CONSTRAINT "faturamento_solicitacoes_faturamentoId_fkey" FOREIGN KEY ("faturamentoId") REFERENCES "faturamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "faturamento_solicitacoes" ADD CONSTRAINT "faturamento_solicitacoes_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "solicitacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NFS-e: campos para correlação com provedor/município (integração externa)
ALTER TABLE "nfs_emitidas" ADD COLUMN "municipioIbge" VARCHAR(7);
ALTER TABLE "nfs_emitidas" ADD COLUMN "provedor" VARCHAR(64);
ALTER TABLE "nfs_emitidas" ADD COLUMN "referenciaExterna" VARCHAR(255);
