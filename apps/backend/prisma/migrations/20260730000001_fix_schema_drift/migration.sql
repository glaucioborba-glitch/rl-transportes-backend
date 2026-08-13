-- PR-23: alinhamento idempotente schema Prisma ↔ banco (ambientes com migrations parciais).

-- 1. Coluna data_nascimento em clientes
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "data_nascimento" TIMESTAMP(3);

-- 2. Enum OutboxEventStatus — valor PROCESSING (outbox worker reclaim)
ALTER TYPE "OutboxEventStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';

-- 3. TipoCaminhao (FK transporte_solicitacao)
DO $$ BEGIN
  CREATE TYPE "TipoCaminhao" AS ENUM ('LS', 'RODOTREM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 4. Tabela transporte_solicitacao
CREATE TABLE IF NOT EXISTS "transporte_solicitacao" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "nome_motorista" VARCHAR(255) NOT NULL,
    "cpf_motorista" VARCHAR(11) NOT NULL,
    "tipo_caminhao" "TipoCaminhao" NOT NULL,
    "placa_cavalo" VARCHAR(10) NOT NULL,
    "placa_carreta_01" VARCHAR(10) NOT NULL,
    "placa_carreta_02" VARCHAR(10),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transporte_solicitacao_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "transporte_solicitacao_solicitacaoId_key"
  ON "transporte_solicitacao"("solicitacaoId");

DO $$ BEGIN
  ALTER TABLE "transporte_solicitacao"
    ADD CONSTRAINT "transporte_solicitacao_solicitacaoId_fkey"
    FOREIGN KEY ("solicitacaoId") REFERENCES "solicitacoes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 5. Tabela solicitante_contato
CREATE TABLE IF NOT EXISTS "solicitante_contato" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "telefone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "solicitante_contato_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "solicitante_contato_solicitacaoId_key"
  ON "solicitante_contato"("solicitacaoId");

DO $$ BEGIN
  ALTER TABLE "solicitante_contato"
    ADD CONSTRAINT "solicitante_contato_solicitacaoId_fkey"
    FOREIGN KEY ("solicitacaoId") REFERENCES "solicitacoes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 6. Tabela solicitacao_anexos
CREATE TABLE IF NOT EXISTS "solicitacao_anexos" (
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

CREATE INDEX IF NOT EXISTS "solicitacao_anexos_solicitacaoId_idx"
  ON "solicitacao_anexos"("solicitacaoId");

CREATE INDEX IF NOT EXISTS "solicitacao_anexos_expires_at_idx"
  ON "solicitacao_anexos"("expires_at");

DO $$ BEGIN
  ALTER TABLE "solicitacao_anexos"
    ADD CONSTRAINT "solicitacao_anexos_solicitacaoId_fkey"
    FOREIGN KEY ("solicitacaoId") REFERENCES "solicitacoes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 7. Onboarding portal (users — não portal_users legado)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_concluido" BOOLEAN NOT NULL DEFAULT false;
