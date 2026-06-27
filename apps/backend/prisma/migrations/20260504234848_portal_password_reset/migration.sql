/*
  Warnings:

  - The `statusPagamento` column on the `boletos` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `statusIpm` column on the `nfs_emitidas` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Made the column `statusBoleto` on table `faturamentos` required. This step will fail if there are existing NULL values in that column.
  - Made the column `ricAssinado` on table `gates` required. This step will fail if there are existing NULL values in that column.
  - Made the column `fotosCaminhao` on table `portarias` required. This step will fail if there are existing NULL values in that column.
  - Made the column `fotosContainer` on table `portarias` required. This step will fail if there are existing NULL values in that column.
  - Made the column `fotosLacre` on table `portarias` required. This step will fail if there are existing NULL values in that column.
  - Made the column `fotosAvarias` on table `portarias` required. This step will fail if there are existing NULL values in that column.
  - Made the column `statusOcr` on table `portarias` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "auditorias" DROP CONSTRAINT "auditorias_usuario_fkey";

-- DropForeignKey
ALTER TABLE "solicitacoes" DROP CONSTRAINT "solicitacoes_clienteId_fkey";

-- AlterTable
ALTER TABLE "boletos" ALTER COLUMN "dataVencimento" SET DATA TYPE TIMESTAMP(3),
DROP COLUMN "statusPagamento",
ADD COLUMN     "statusPagamento" TEXT NOT NULL DEFAULT 'pendente',
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "clientes" ALTER COLUMN "telefone" DROP NOT NULL,
ALTER COLUMN "endereco" DROP NOT NULL;

-- AlterTable
ALTER TABLE "faturamentos" ADD COLUMN     "statusNfe" TEXT NOT NULL DEFAULT 'pendente',
ALTER COLUMN "statusBoleto" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "gates" ALTER COLUMN "ricAssinado" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "nfs_emitidas" DROP COLUMN "statusIpm",
ADD COLUMN     "statusIpm" TEXT NOT NULL DEFAULT 'pendente',
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "patios" ALTER COLUMN "quadra" SET DATA TYPE TEXT,
ALTER COLUMN "fileira" SET DATA TYPE TEXT,
ALTER COLUMN "posicao" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "portarias" ALTER COLUMN "fotosCaminhao" SET NOT NULL,
ALTER COLUMN "fotosContainer" SET NOT NULL,
ALTER COLUMN "fotosLacre" SET NOT NULL,
ALTER COLUMN "fotosAvarias" SET NOT NULL,
ALTER COLUMN "statusOcr" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CLIENTE';

-- CreateTable
CREATE TABLE "portal_password_resets" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "portal_password_resets_token_key" ON "portal_password_resets"("token");

-- CreateIndex
CREATE INDEX "portal_password_resets_token_idx" ON "portal_password_resets"("token");

-- CreateIndex
CREATE INDEX "boletos_statusPagamento_idx" ON "boletos"("statusPagamento");

-- CreateIndex
CREATE INDEX "clientes_cpfCnpj_idx" ON "clientes"("cpfCnpj");

-- CreateIndex
CREATE INDEX "clientes_email_idx" ON "clientes"("email");

-- CreateIndex
CREATE INDEX "solicitacoes_status_idx" ON "solicitacoes"("status");

-- CreateIndex
CREATE INDEX "unidades_solicitacao_numeroIso_idx" ON "unidades_solicitacao"("numeroIso");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- AddForeignKey
ALTER TABLE "portal_password_resets" ADD CONSTRAINT "portal_password_resets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
