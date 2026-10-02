-- Yard Management v2 + status AGUARDANDO_GATE_OUT

ALTER TYPE "StatusSolicitacao" ADD VALUE 'AGUARDANDO_GATE_OUT';

CREATE TYPE "PatioStatus" AS ENUM ('ESTOCADO', 'MOVIMENTANDO', 'SEPARADO', 'AGUARDANDO_GATE_OUT');

CREATE TYPE "MovTipo" AS ENUM ('LIFT_ON', 'LIFT_OFF', 'SHIFT', 'REPOSICIONAMENTO');

CREATE TABLE "patio_v2_posicoes" (
    "id" TEXT NOT NULL,
    "codigo_baia" VARCHAR(16) NOT NULL,
    "comprimento" INTEGER NOT NULL,
    "largura" INTEGER NOT NULL,
    "capacidade" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patio_v2_posicoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "patio_v2_posicoes_codigo_baia_key" ON "patio_v2_posicoes"("codigo_baia");

CREATE TABLE "patio_v2_unidades" (
    "id" TEXT NOT NULL,
    "unidade_iso" VARCHAR(16) NOT NULL,
    "solicitacao_id" TEXT NOT NULL,
    "gate_in_id" TEXT NOT NULL,
    "posicao_atual_id" TEXT,
    "status" "PatioStatus" NOT NULL DEFAULT 'SEPARADO',
    "refrigerado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patio_v2_unidades_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "patio_v2_movimentacoes" (
    "id" TEXT NOT NULL,
    "unidade_id" TEXT NOT NULL,
    "operador_id" TEXT NOT NULL,
    "origem_id" TEXT,
    "destino_id" TEXT,
    "tipo" "MovTipo" NOT NULL,
    "observacao" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patio_v2_movimentacoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "patio_v2_unidades_gate_in_id_unidade_iso_key" ON "patio_v2_unidades"("gate_in_id", "unidade_iso");
CREATE INDEX "patio_v2_unidades_solicitacao_id_idx" ON "patio_v2_unidades"("solicitacao_id");
CREATE INDEX "patio_v2_unidades_unidade_iso_idx" ON "patio_v2_unidades"("unidade_iso");
CREATE INDEX "patio_v2_unidades_status_idx" ON "patio_v2_unidades"("status");
CREATE INDEX "patio_v2_unidades_posicao_atual_id_idx" ON "patio_v2_unidades"("posicao_atual_id");

CREATE INDEX "patio_v2_movimentacoes_unidade_id_idx" ON "patio_v2_movimentacoes"("unidade_id");
CREATE INDEX "patio_v2_movimentacoes_operador_id_idx" ON "patio_v2_movimentacoes"("operador_id");
CREATE INDEX "patio_v2_movimentacoes_created_at_idx" ON "patio_v2_movimentacoes"("created_at");

ALTER TABLE "patio_v2_unidades" ADD CONSTRAINT "patio_v2_unidades_solicitacao_id_fkey" FOREIGN KEY ("solicitacao_id") REFERENCES "solicitacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "patio_v2_unidades" ADD CONSTRAINT "patio_v2_unidades_gate_in_id_fkey" FOREIGN KEY ("gate_in_id") REFERENCES "gate_v2_check_ins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "patio_v2_unidades" ADD CONSTRAINT "patio_v2_unidades_posicao_atual_id_fkey" FOREIGN KEY ("posicao_atual_id") REFERENCES "patio_v2_posicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "patio_v2_movimentacoes" ADD CONSTRAINT "patio_v2_movimentacoes_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "patio_v2_unidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "patio_v2_movimentacoes" ADD CONSTRAINT "patio_v2_movimentacoes_operador_id_fkey" FOREIGN KEY ("operador_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "patio_v2_movimentacoes" ADD CONSTRAINT "patio_v2_movimentacoes_origem_id_fkey" FOREIGN KEY ("origem_id") REFERENCES "patio_v2_posicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "patio_v2_movimentacoes" ADD CONSTRAINT "patio_v2_movimentacoes_destino_id_fkey" FOREIGN KEY ("destino_id") REFERENCES "patio_v2_posicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Baias padrão (grid inicial A01–A04, B01–B04)
INSERT INTO "patio_v2_posicoes" ("id", "codigo_baia", "comprimento", "largura", "capacidade") VALUES
  ('patio-pos-a01', 'A01', 12, 3, 4),
  ('patio-pos-a02', 'A02', 12, 3, 4),
  ('patio-pos-a03', 'A03', 12, 3, 4),
  ('patio-pos-a04', 'A04', 12, 3, 4),
  ('patio-pos-b01', 'B01', 12, 3, 4),
  ('patio-pos-b02', 'B02', 12, 3, 4),
  ('patio-pos-b03', 'B03', 12, 3, 4),
  ('patio-pos-b04', 'B04', 12, 3, 4);
