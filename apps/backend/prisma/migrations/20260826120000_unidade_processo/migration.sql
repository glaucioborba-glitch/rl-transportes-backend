-- UnidadeProcesso: ciclo de vida da unidade (entrada → ID sequencial → saída).
-- Visita do caminhão (GateCheckIn/Out) permanece registro; estoque e pré-fatura passam a depender do ID.

CREATE TYPE "StatusUnidadeProcesso" AS ENUM ('ABERTO', 'ENCERRADO', 'CANCELADO');

CREATE SEQUENCE IF NOT EXISTS unidade_processos_numero_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE "unidade_processos" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "numero" INTEGER NOT NULL,
    "unidade_iso" VARCHAR(16) NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "status" "StatusUnidadeProcesso" NOT NULL DEFAULT 'ABERTO',
    "entrada_em" TIMESTAMP(3) NOT NULL,
    "saida_em" TIMESTAMP(3),
    "entrada_solicitacao_id" TEXT NOT NULL,
    "saida_solicitacao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unidade_processos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "unidade_processos_tenant_id_numero_key" ON "unidade_processos"("tenant_id", "numero");
CREATE UNIQUE INDEX "unidade_processos_iso_aberto_uidx" ON "unidade_processos"("unidade_iso") WHERE "status" = 'ABERTO';
CREATE INDEX "unidade_processos_unidade_iso_status_idx" ON "unidade_processos"("unidade_iso", "status");
CREATE INDEX "unidade_processos_cliente_id_status_idx" ON "unidade_processos"("cliente_id", "status");
CREATE INDEX "unidade_processos_entrada_solicitacao_id_idx" ON "unidade_processos"("entrada_solicitacao_id");
CREATE INDEX "unidade_processos_saida_solicitacao_id_idx" ON "unidade_processos"("saida_solicitacao_id");

ALTER TABLE "unidade_processos" ADD CONSTRAINT "unidade_processos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unidade_processos" ADD CONSTRAINT "unidade_processos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "unidade_processos" ADD CONSTRAINT "unidade_processos_entrada_solicitacao_id_fkey" FOREIGN KEY ("entrada_solicitacao_id") REFERENCES "solicitacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unidade_processos" ADD CONSTRAINT "unidade_processos_saida_solicitacao_id_fkey" FOREIGN KEY ("saida_solicitacao_id") REFERENCES "solicitacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "unidades_solicitacao_numeroIso_key";
CREATE UNIQUE INDEX IF NOT EXISTS "unidades_solicitacao_solicitacaoId_numeroIso_key" ON "unidades_solicitacao"("solicitacaoId", "numeroIso");

ALTER TABLE "patio_v2_unidades" ALTER COLUMN "gate_in_id" DROP NOT NULL;
ALTER TABLE "patio_v2_unidades" DROP CONSTRAINT IF EXISTS "patio_v2_unidades_gate_in_id_fkey";
ALTER TABLE "patio_v2_unidades" ADD CONSTRAINT "patio_v2_unidades_gate_in_id_fkey" FOREIGN KEY ("gate_in_id") REFERENCES "gate_v2_check_ins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "patio_v2_unidades" ADD COLUMN IF NOT EXISTS "unidade_processo_id" TEXT;
CREATE INDEX IF NOT EXISTS "patio_v2_unidades_unidade_processo_id_idx" ON "patio_v2_unidades"("unidade_processo_id");
CREATE UNIQUE INDEX IF NOT EXISTS "patio_v2_unidades_unidade_processo_id_unidade_iso_key" ON "patio_v2_unidades"("unidade_processo_id", "unidade_iso");
ALTER TABLE "patio_v2_unidades" ADD CONSTRAINT "patio_v2_unidades_unidade_processo_id_fkey" FOREIGN KEY ("unidade_processo_id") REFERENCES "unidade_processos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pre_faturas" ALTER COLUMN "gate_in_id" DROP NOT NULL;
ALTER TABLE "pre_faturas" DROP CONSTRAINT IF EXISTS "pre_faturas_gate_in_id_fkey";
ALTER TABLE "pre_faturas" ADD CONSTRAINT "pre_faturas_gate_in_id_fkey" FOREIGN KEY ("gate_in_id") REFERENCES "gate_v2_check_ins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pre_faturas" ADD COLUMN IF NOT EXISTS "unidade_processo_id" TEXT;
CREATE INDEX IF NOT EXISTS "pre_faturas_unidade_processo_id_idx" ON "pre_faturas"("unidade_processo_id");
CREATE UNIQUE INDEX IF NOT EXISTS "pre_faturas_unidade_processo_id_container_iso_key" ON "pre_faturas"("unidade_processo_id", "container_iso");
ALTER TABLE "pre_faturas" ADD CONSTRAINT "pre_faturas_unidade_processo_id_fkey" FOREIGN KEY ("unidade_processo_id") REFERENCES "unidade_processos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Estoque legado (pátio sem check-out) vira ID aberto para não quebrar coleta em andamento.
INSERT INTO "unidade_processos" (
  "id", "tenant_id", "numero", "unidade_iso", "cliente_id", "status",
  "entrada_em", "entrada_solicitacao_id", "created_at", "updated_at"
)
SELECT DISTINCT ON (pu."unidade_iso")
  gen_random_uuid()::text,
  s."tenant_id",
  nextval('unidade_processos_numero_seq')::integer,
  pu."unidade_iso",
  s."clienteId",
  'ABERTO',
  pu."created_at",
  pu."solicitacao_id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "patio_v2_unidades" pu
INNER JOIN "solicitacoes" s ON s."id" = pu."solicitacao_id"
LEFT JOIN "gate_v2_check_outs" go ON go."gate_in_id" = pu."gate_in_id"
WHERE pu."unidade_processo_id" IS NULL
  AND (pu."gate_in_id" IS NULL OR go."id" IS NULL)
  AND NOT EXISTS (
    SELECT 1 FROM "unidade_processos" up
    WHERE up."unidade_iso" = pu."unidade_iso" AND up."status" = 'ABERTO'
  )
ORDER BY pu."unidade_iso", pu."created_at" ASC;

UPDATE "patio_v2_unidades" pu
SET "unidade_processo_id" = up."id"
FROM "unidade_processos" up
WHERE pu."unidade_processo_id" IS NULL
  AND up."entrada_solicitacao_id" = pu."solicitacao_id"
  AND up."unidade_iso" = pu."unidade_iso"
  AND up."status" = 'ABERTO';

UPDATE "pre_faturas" pf
SET "unidade_processo_id" = pu."unidade_processo_id"
FROM "patio_v2_unidades" pu
WHERE pf."unidade_processo_id" IS NULL
  AND pu."unidade_processo_id" IS NOT NULL
  AND pu."unidade_iso" = pf."container_iso"
  AND (
    (pf."gate_in_id" IS NOT NULL AND pu."gate_in_id" = pf."gate_in_id")
    OR pu."solicitacao_id" IN (
      SELECT gi."solicitacaoId" FROM "gate_v2_check_ins" gi WHERE gi."id" = pf."gate_in_id"
    )
  );
