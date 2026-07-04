-- Aceite de Termos de Uso (non-repudiation) no cadastro de clientes
ALTER TABLE "clientes" ADD COLUMN "termos_aceitos_em" TIMESTAMP(3);
ALTER TABLE "clientes" ADD COLUMN "termos_aceitos_ip" VARCHAR(64);
ALTER TABLE "clientes" ADD COLUMN "termos_versao" VARCHAR(32);

CREATE TABLE "termos_uso" (
    "id" TEXT NOT NULL,
    "versao" VARCHAR(32) NOT NULL,
    "conteudo_html" TEXT NOT NULL,
    "data_publicacao" TIMESTAMP(3) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "termos_uso_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "termos_uso_versao_key" ON "termos_uso"("versao");
