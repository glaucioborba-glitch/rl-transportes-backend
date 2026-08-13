-- CreateTable
CREATE TABLE "pessoas_autorizadas" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "telefone" VARCHAR(20),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pessoas_autorizadas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pessoas_autorizadas_cliente_id_idx" ON "pessoas_autorizadas"("cliente_id");

-- AddForeignKey
ALTER TABLE "pessoas_autorizadas" ADD CONSTRAINT "pessoas_autorizadas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
