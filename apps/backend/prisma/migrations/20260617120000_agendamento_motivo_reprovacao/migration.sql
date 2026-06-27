-- Triagem manual: motivo quando agendamento reprovado (status CANCELADO).
ALTER TABLE "agendamentos_terminal"
ADD COLUMN IF NOT EXISTS "motivo_reprovacao" VARCHAR(500);
