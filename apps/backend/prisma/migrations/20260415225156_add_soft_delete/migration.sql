-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "solicitacoes" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "clientes_deletedAt_idx" ON "clientes"("deletedAt");

-- CreateIndex
CREATE INDEX "solicitacoes_deletedAt_idx" ON "solicitacoes"("deletedAt");
