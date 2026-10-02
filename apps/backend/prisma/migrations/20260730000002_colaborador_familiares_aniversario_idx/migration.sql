-- Índice para consultas de aniversários (agenda de eventos RH).

CREATE INDEX IF NOT EXISTS "idx_colab_familiares_aniversario"
  ON "colaborador_familiares"("data_aniversario");
