-- Enriquecimento preditivo — permanência estimada e classificação de giro (pátio ML-ready).

CREATE TYPE "GiroEstimado" AS ENUM ('RAPIDO', 'MEDIO', 'LENTO');

ALTER TABLE solicitacoes
  ADD COLUMN IF NOT EXISTS previsao_retirada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS booking_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS giro_estimado "GiroEstimado";

CREATE INDEX IF NOT EXISTS solicitacoes_giro_estimado_idx ON solicitacoes (giro_estimado);
