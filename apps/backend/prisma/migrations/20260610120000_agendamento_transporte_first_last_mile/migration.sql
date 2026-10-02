-- Agendamento terminal: First/Last Mile (transporte rodoviário)

CREATE TYPE "ModalidadeTransporte" AS ENUM ('FROTA_CLIENTE', 'FROTA_FL');
CREATE TYPE "StatusCarga" AS ENUM ('CHEIO', 'VAZIO');
CREATE TYPE "TipoOperacaoAgendamento" AS ENUM ('GATE_IN', 'GATE_OUT');

ALTER TABLE "agendamentos_terminal" ADD COLUMN "tipo_operacao" "TipoOperacaoAgendamento" NOT NULL DEFAULT 'GATE_IN';
ALTER TABLE "agendamentos_terminal" ADD COLUMN "modalidade_transporte" "ModalidadeTransporte" NOT NULL DEFAULT 'FROTA_CLIENTE';
ALTER TABLE "agendamentos_terminal" ADD COLUMN "status_carga" "StatusCarga" NOT NULL DEFAULT 'CHEIO';
ALTER TABLE "agendamentos_terminal" ADD COLUMN "local_origem" VARCHAR(255);
ALTER TABLE "agendamentos_terminal" ADD COLUMN "local_destino" VARCHAR(255);
ALTER TABLE "agendamentos_terminal" ADD COLUMN "valor_frete" DECIMAL(10, 2);

DROP INDEX IF EXISTS "agendamentos_terminal_data_ref_turno_numero_iso_key";
CREATE UNIQUE INDEX "agendamentos_terminal_data_ref_turno_numero_iso_tipo_operacao_key"
  ON "agendamentos_terminal"("data_ref", "turno", "numero_iso", "tipo_operacao");

CREATE INDEX "agendamentos_terminal_numero_iso_tipo_operacao_idx"
  ON "agendamentos_terminal"("numero_iso", "tipo_operacao");
