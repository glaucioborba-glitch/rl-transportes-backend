-- Sábado semanal é turno de 4h contínuas: sem intervalo.
UPDATE "rh_turnos_jornada"
SET
  "sabado_intervalo_inicio" = NULL,
  "sabado_intervalo_fim" = NULL
WHERE "regime_sabado" = 'TODOS_SABADOS';
