-- Fase 2 — constraints e alinhamento ao PDF (16/04/2026)

-- UnidadeSolicitacao: ISO único global + CASCADE ao excluir solicitação
DROP INDEX IF EXISTS "unidades_solicitacao_solicitacaoId_idx";
CREATE INDEX "unidades_solicitacao_solicitacaoId_idx" ON "unidades_solicitacao"("solicitacaoId");
CREATE UNIQUE INDEX "unidades_solicitacao_numeroIso_key" ON "unidades_solicitacao"("numeroIso");
ALTER TABLE "unidades_solicitacao" DROP CONSTRAINT IF EXISTS "unidades_solicitacao_solicitacaoId_fkey";
ALTER TABLE "unidades_solicitacao" ADD CONSTRAINT "unidades_solicitacao_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "solicitacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Portaria: placa, defaults JSON, statusOcr, updatedAt
ALTER TABLE "portarias" ADD COLUMN IF NOT EXISTS "placaVeiculo" VARCHAR(10);
UPDATE "portarias" SET "fotosCaminhao" = '[]'::jsonb WHERE "fotosCaminhao" IS NULL;
UPDATE "portarias" SET "fotosContainer" = '[]'::jsonb WHERE "fotosContainer" IS NULL;
UPDATE "portarias" SET "fotosLacre" = '[]'::jsonb WHERE "fotosLacre" IS NULL;
UPDATE "portarias" SET "fotosAvarias" = '[]'::jsonb WHERE "fotosAvarias" IS NULL;
UPDATE "portarias" SET "statusOcr" = 'pendente' WHERE "statusOcr" IS NULL;
ALTER TABLE "portarias" ALTER COLUMN "fotosCaminhao" SET DEFAULT '[]'::jsonb;
ALTER TABLE "portarias" ALTER COLUMN "fotosContainer" SET DEFAULT '[]'::jsonb;
ALTER TABLE "portarias" ALTER COLUMN "fotosLacre" SET DEFAULT '[]'::jsonb;
ALTER TABLE "portarias" ALTER COLUMN "fotosAvarias" SET DEFAULT '[]'::jsonb;
ALTER TABLE "portarias" ALTER COLUMN "statusOcr" SET DEFAULT 'pendente';
ALTER TABLE "portarias" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "portarias" DROP CONSTRAINT IF EXISTS "portarias_solicitacaoId_fkey";
ALTER TABLE "portarias" ADD CONSTRAINT "portarias_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "solicitacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Gate: RIC boolean + updatedAt + CASCADE
ALTER TABLE "gates" ALTER COLUMN "ricAssinado" DROP DEFAULT;
ALTER TABLE "gates" ALTER COLUMN "ricAssinado" TYPE BOOLEAN USING (
  CASE
    WHEN "ricAssinado" IS NULL THEN false
    WHEN TRIM(LOWER("ricAssinado"::text)) IN ('true', 't', '1', 'sim', 'yes') THEN true
    ELSE false
  END
);
ALTER TABLE "gates" ALTER COLUMN "ricAssinado" SET DEFAULT false;
ALTER TABLE "gates" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "gates" DROP CONSTRAINT IF EXISTS "gates_solicitacaoId_fkey";
ALTER TABLE "gates" ADD CONSTRAINT "gates_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "solicitacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Pátio: posição física única + updatedAt + CASCADE
ALTER TABLE "patios" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX IF NOT EXISTS "patios_quadra_fileira_posicao_key" ON "patios"("quadra", "fileira", "posicao");
ALTER TABLE "patios" ALTER COLUMN "quadra" TYPE VARCHAR(10);
ALTER TABLE "patios" ALTER COLUMN "fileira" TYPE VARCHAR(10);
ALTER TABLE "patios" ALTER COLUMN "posicao" TYPE VARCHAR(10);
ALTER TABLE "patios" DROP CONSTRAINT IF EXISTS "patios_solicitacaoId_fkey";
ALTER TABLE "patios" ADD CONSTRAINT "patios_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "solicitacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Saída: CASCADE
ALTER TABLE "saidas" DROP CONSTRAINT IF EXISTS "saidas_solicitacaoId_fkey";
ALTER TABLE "saidas" ADD CONSTRAINT "saidas_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "solicitacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Faturamento: período único por cliente, status boleto default, updatedAt, CASCADE cliente
UPDATE "faturamentos" SET "statusBoleto" = 'pendente' WHERE "statusBoleto" IS NULL;
ALTER TABLE "faturamentos" ALTER COLUMN "statusBoleto" SET DEFAULT 'pendente';
ALTER TABLE "faturamentos" DROP COLUMN IF EXISTS "statusNfe";
ALTER TABLE "faturamentos" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX IF NOT EXISTS "faturamentos_clienteId_periodo_key" ON "faturamentos"("clienteId", "periodo");
ALTER TABLE "faturamentos" DROP CONSTRAINT IF EXISTS "faturamentos_clienteId_fkey";
ALTER TABLE "faturamentos" ADD CONSTRAINT "faturamentos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NFS-e: número único, XML obrigatório, updatedAt, CASCADE
UPDATE "nfs_emitidas" SET "xmlNfe" = '' WHERE "xmlNfe" IS NULL;
ALTER TABLE "nfs_emitidas" ALTER COLUMN "xmlNfe" SET NOT NULL;
ALTER TABLE "nfs_emitidas" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX IF NOT EXISTS "nfs_emitidas_numeroNfe_key" ON "nfs_emitidas"("numeroNfe");
ALTER TABLE "nfs_emitidas" DROP CONSTRAINT IF EXISTS "nfs_emitidas_faturamentoId_fkey";
ALTER TABLE "nfs_emitidas" ADD CONSTRAINT "nfs_emitidas_faturamentoId_fkey" FOREIGN KEY ("faturamentoId") REFERENCES "faturamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Boleto: número único, data DATE, updatedAt, CASCADE
ALTER TABLE "boletos" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX IF NOT EXISTS "boletos_numeroBoleto_key" ON "boletos"("numeroBoleto");
ALTER TABLE "boletos" ALTER COLUMN "dataVencimento" SET DATA TYPE DATE USING ("dataVencimento"::date);
ALTER TABLE "boletos" DROP CONSTRAINT IF EXISTS "boletos_faturamentoId_fkey";
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_faturamentoId_fkey" FOREIGN KEY ("faturamentoId") REFERENCES "faturamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Auditoria: índices usuario e createdAt
CREATE INDEX IF NOT EXISTS "auditorias_usuario_idx" ON "auditorias"("usuario");
CREATE INDEX IF NOT EXISTS "auditorias_createdAt_idx" ON "auditorias"("createdAt");
