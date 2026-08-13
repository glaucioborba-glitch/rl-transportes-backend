-- Motor Financeiro V2: perfil por cliente, mora e tolerância individualizada

ALTER TYPE "StatusPagamentoFatura" ADD VALUE IF NOT EXISTS 'VENCIDA';

ALTER TABLE "clientes"
  ADD COLUMN IF NOT EXISTS "dias_tolerancia_bloqueio" INTEGER,
  ADD COLUMN IF NOT EXISTS "percentual_multa_atraso" DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS "percentual_juros_ao_mes" DECIMAL(5, 2);

ALTER TABLE "faturas_armazenagem"
  ADD COLUMN IF NOT EXISTS "data_vencimento" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "valor_atualizado" DECIMAL(10, 2);

ALTER TABLE "boletos"
  ADD COLUMN IF NOT EXISTS "valor_atualizado" DECIMAL(10, 2);
