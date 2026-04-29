-- AcaoAuditoria: leitura sensível e eventos de segurança (tentativas fora de escopo)
ALTER TYPE "AcaoAuditoria" ADD VALUE 'READ';
ALTER TYPE "AcaoAuditoria" ADD VALUE 'SEGURANCA';

-- Itens de faturamento: valor do cabeçalho = soma das linhas
CREATE TABLE "faturamento_itens" (
    "id" TEXT NOT NULL,
    "faturamentoId" TEXT NOT NULL,
    "descricao" VARCHAR(500) NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "faturamento_itens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "faturamento_itens_faturamentoId_idx" ON "faturamento_itens"("faturamentoId");

ALTER TABLE "faturamento_itens" ADD CONSTRAINT "faturamento_itens_faturamentoId_fkey" FOREIGN KEY ("faturamentoId") REFERENCES "faturamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Registo legado: um item por faturamento existente (valor = valorTotal anterior)
INSERT INTO "faturamento_itens" ("id", "faturamentoId", "descricao", "valor", "createdAt")
SELECT gen_random_uuid()::text, "id", 'Migração — valor agregado (período único)', "valorTotal", "createdAt" FROM "faturamentos";
