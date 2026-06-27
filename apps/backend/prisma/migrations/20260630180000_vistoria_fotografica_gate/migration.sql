-- Vistoria fotográfica Gate (Damage Control PWA)

CREATE TYPE "TipoVistoria" AS ENUM ('GATE_IN', 'GATE_OUT');
CREATE TYPE "AnguloFotoVistoria" AS ENUM ('FRENTE', 'TRASEIRA', 'LATERAL_DIREITA', 'LATERAL_ESQUERDA');

CREATE TABLE "vistorias" (
    "id" TEXT NOT NULL,
    "solicitacao_id" TEXT NOT NULL,
    "gate_check_in_id" TEXT,
    "gate_check_out_id" TEXT,
    "tipo" "TipoVistoria" NOT NULL,
    "avarias" JSONB NOT NULL DEFAULT '[]',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vistorias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vistorias_gate_check_out_id_key" ON "vistorias"("gate_check_out_id");
CREATE INDEX "vistorias_solicitacao_id_tipo_idx" ON "vistorias"("solicitacao_id", "tipo");
CREATE INDEX "vistorias_gate_check_in_id_idx" ON "vistorias"("gate_check_in_id");

ALTER TABLE "vistorias" ADD CONSTRAINT "vistorias_solicitacao_id_fkey"
  FOREIGN KEY ("solicitacao_id") REFERENCES "solicitacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vistorias" ADD CONSTRAINT "vistorias_gate_check_in_id_fkey"
  FOREIGN KEY ("gate_check_in_id") REFERENCES "gate_v2_check_ins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vistorias" ADD CONSTRAINT "vistorias_gate_check_out_id_fkey"
  FOREIGN KEY ("gate_check_out_id") REFERENCES "gate_v2_check_outs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "fotos_vistoria" (
    "id" TEXT NOT NULL,
    "vistoria_id" TEXT NOT NULL,
    "angulo" "AnguloFotoVistoria" NOT NULL,
    "url" VARCHAR(1000) NOT NULL,
    "storage_key" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fotos_vistoria_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fotos_vistoria_vistoria_id_angulo_key" ON "fotos_vistoria"("vistoria_id", "angulo");
CREATE INDEX "fotos_vistoria_vistoria_id_idx" ON "fotos_vistoria"("vistoria_id");

ALTER TABLE "fotos_vistoria" ADD CONSTRAINT "fotos_vistoria_vistoria_id_fkey"
  FOREIGN KEY ("vistoria_id") REFERENCES "vistorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
