ALTER TABLE "rh_turnos_jornada"
  ADD COLUMN "intervalo_inicio" VARCHAR(8),
  ADD COLUMN "intervalo_fim" VARCHAR(8),
  ADD COLUMN "sabado_intervalo_inicio" VARCHAR(8),
  ADD COLUMN "sabado_intervalo_fim" VARCHAR(8);

UPDATE "rh_turnos_jornada"
SET
  "intervalo_inicio" = COALESCE("intervalo_inicio", '12:00'),
  "intervalo_fim" = COALESCE("intervalo_fim", '13:00')
WHERE "deleted_at" IS NULL;

UPDATE "rh_turnos_jornada"
SET
  "sabado_intervalo_inicio" = COALESCE("sabado_intervalo_inicio", '12:00'),
  "sabado_intervalo_fim" = COALESCE("sabado_intervalo_fim", '13:00')
WHERE "deleted_at" IS NULL
  AND "regime_sabado" <> 'SEM_SABADO';
