ALTER TABLE "agendamentos_solicitacao"
  DROP COLUMN IF EXISTS "atendimento_especial",
  DROP COLUMN IF EXISTS "atendimento_especial_texto",
  DROP COLUMN IF EXISTS "atendimento_especial_audit";
