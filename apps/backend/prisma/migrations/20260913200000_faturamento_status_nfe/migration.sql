-- Drift: schema exige statusNfe, mas a coluna foi dropada em 20260416140000 e
-- a recriação de 20260504234848 não está neste banco.
ALTER TABLE "faturamentos" ADD COLUMN IF NOT EXISTS "statusNfe" TEXT NOT NULL DEFAULT 'pendente';
