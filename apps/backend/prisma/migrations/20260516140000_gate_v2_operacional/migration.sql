-- Gate operacional v2 + status de fila física

ALTER TYPE "StatusSolicitacao" ADD VALUE 'AGUARDANDO_GATE_IN';
ALTER TYPE "StatusSolicitacao" ADD VALUE 'EM_PATIO';

CREATE TABLE "gate_v2_check_ins" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "operadorId" TEXT NOT NULL,
    "data_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "placa_cavalo" VARCHAR(12) NOT NULL,
    "placa_carreta_01" VARCHAR(12) NOT NULL,
    "placa_carreta_02" VARCHAR(12),
    "motorista_nome" VARCHAR(255) NOT NULL,
    "motorista_cpf" VARCHAR(11) NOT NULL,
    "fotos_entrada" JSONB NOT NULL DEFAULT '[]',
    "divergencias_json" JSONB NOT NULL DEFAULT '[]',
    "ocr_placa_json" JSONB,
    "pdf_hash_validado" VARCHAR(64),

    CONSTRAINT "gate_v2_check_ins_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gate_v2_check_outs" (
    "id" TEXT NOT NULL,
    "gate_in_id" TEXT NOT NULL,
    "operador_id" TEXT NOT NULL,
    "data_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fotos_saida" JSONB NOT NULL DEFAULT '[]',
    "divergencias_json" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "gate_v2_check_outs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gate_v2_check_outs_gate_in_id_key" ON "gate_v2_check_outs"("gate_in_id");

CREATE INDEX "gate_v2_check_ins_solicitacaoId_idx" ON "gate_v2_check_ins"("solicitacaoId");
CREATE INDEX "gate_v2_check_ins_operadorId_idx" ON "gate_v2_check_ins"("operadorId");
CREATE INDEX "gate_v2_check_ins_data_hora_idx" ON "gate_v2_check_ins"("data_hora");

CREATE INDEX "gate_v2_check_outs_operador_id_idx" ON "gate_v2_check_outs"("operador_id");
CREATE INDEX "gate_v2_check_outs_data_hora_idx" ON "gate_v2_check_outs"("data_hora");

ALTER TABLE "gate_v2_check_ins" ADD CONSTRAINT "gate_v2_check_ins_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "solicitacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gate_v2_check_ins" ADD CONSTRAINT "gate_v2_check_ins_operadorId_fkey" FOREIGN KEY ("operadorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "gate_v2_check_outs" ADD CONSTRAINT "gate_v2_check_outs_gate_in_id_fkey" FOREIGN KEY ("gate_in_id") REFERENCES "gate_v2_check_ins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gate_v2_check_outs" ADD CONSTRAINT "gate_v2_check_outs_operador_id_fkey" FOREIGN KEY ("operador_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE VIEW vw_solicitacoes_v1_compat AS
SELECT
  s.id,
  s.protocolo,
  s."clienteId" AS "clienteId",
  s.status::text AS "statusDb",
  CASE s.status::text
    WHEN 'APROVADO' THEN 'APROVADA'
    WHEN 'REJEITADO' THEN 'REJEITADA'
    WHEN 'CONCLUIDO' THEN 'CONCLUIDA'
    WHEN 'CANCELADO' THEN 'CANCELADA'
    WHEN 'EM_ANALISE' THEN 'EM_ANALISE'
    WHEN 'EM_EXECUCAO' THEN 'EM_EXECUCAO'
    WHEN 'AGUARDANDO_GATE_IN' THEN 'AGUARDANDO_CHECK_IN'
    WHEN 'EM_PATIO' THEN 'EM_PATIO'
    WHEN 'PENDENTE' THEN 'PENDENTE'
    ELSE s.status::text
  END AS "statusV2Label",
  s."createdAt" AS "createdAt",
  s."updatedAt" AS "updatedAt",
  t.tipo_caminhao::text AS "tipoCaminhao",
  (
    SELECT COUNT(*)::int
    FROM containers_solicitacao c
    WHERE c."solicitacaoId" = s.id
  ) AS "qtdContainers",
  EXISTS (
    SELECT 1 FROM transporte_solicitacao ts WHERE ts."solicitacaoId" = s.id
  ) AS "isFluxoCorporativoV2"
FROM solicitacoes s
LEFT JOIN transporte_solicitacao t ON t."solicitacaoId" = s.id
WHERE s."deletedAt" IS NULL;
