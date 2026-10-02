-- Delegação operacional B2B: roles portal + transportadoras autorizadas

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ADMIN_CLIENTE';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'OPERADOR_INTERNO';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'TRANSPORTADORA_TERCEIRA';

UPDATE "users" SET "role" = 'ADMIN_CLIENTE' WHERE "role" = 'CLIENTE';

CREATE TABLE "transportadoras_autorizadas" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "cnpj" VARCHAR(14) NOT NULL,
    "razao_social" VARCHAR(255) NOT NULL,
    "email_contato" VARCHAR(255) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transportadoras_autorizadas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "transportadoras_autorizadas_user_id_key" ON "transportadoras_autorizadas"("user_id");
CREATE UNIQUE INDEX "transportadoras_autorizadas_cliente_id_cnpj_key" ON "transportadoras_autorizadas"("cliente_id", "cnpj");
CREATE INDEX "transportadoras_autorizadas_cliente_id_idx" ON "transportadoras_autorizadas"("cliente_id");

ALTER TABLE "transportadoras_autorizadas" ADD CONSTRAINT "transportadoras_autorizadas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transportadoras_autorizadas" ADD CONSTRAINT "transportadoras_autorizadas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
