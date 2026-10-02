-- Workforce Planning: funcionários operacionais e escalas por turno

CREATE TYPE "CargoFuncionario" AS ENUM ('GATE_CHECKER', 'OPERADOR_EMPILHADEIRA', 'ADMINISTRATIVO');
CREATE TYPE "StatusFuncionario" AS ENUM ('ATIVO', 'INATIVO');
CREATE TYPE "TurnoEscala" AS ENUM ('MANHA', 'TARDE', 'NOITE');

CREATE TABLE "funcionarios" (
    "id" TEXT NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "cpf" VARCHAR(11) NOT NULL,
    "cargo" "CargoFuncionario" NOT NULL,
    "status" "StatusFuncionario" NOT NULL DEFAULT 'ATIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funcionarios_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "funcionarios_cpf_key" ON "funcionarios"("cpf");
CREATE INDEX "funcionarios_cargo_status_idx" ON "funcionarios"("cargo", "status");

CREATE TABLE "escalas_turno" (
    "id" TEXT NOT NULL,
    "funcionario_id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "turno" "TurnoEscala" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escalas_turno_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "escalas_turno_funcionario_id_data_turno_key" ON "escalas_turno"("funcionario_id", "data", "turno");
CREATE INDEX "escalas_turno_data_turno_idx" ON "escalas_turno"("data", "turno");

ALTER TABLE "escalas_turno" ADD CONSTRAINT "escalas_turno_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "funcionarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
