-- AlterTable
ALTER TABLE "pessoas_autorizadas" ADD COLUMN "cpf" VARCHAR(11);

-- CreateIndex
CREATE UNIQUE INDEX "pessoas_autorizadas_cliente_id_cpf_key" ON "pessoas_autorizadas"("cliente_id", "cpf");
