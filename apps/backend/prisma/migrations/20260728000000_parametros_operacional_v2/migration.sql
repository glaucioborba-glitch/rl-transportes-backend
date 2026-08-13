-- PR-27: expand operacional JSONB (turnos, feriados, TEU, antecedência, cancelamento)
UPDATE "tenant_configs"
SET "parametros" = jsonb_set(
  COALESCE("parametros", '{}'::jsonb),
  '{operacional}',
  COALESCE("parametros"->'operacional', '{}'::jsonb) || '{
    "turnos": [
      {"id":"t1","codigo":"MANHA","nome":"Manhã","horaInicio":"06:00","horaFim":"14:00","capacidadeMaxima":15,"diasSemana":["SEG","TER","QUA","QUI","SEX"],"ativo":true},
      {"id":"t2","codigo":"TARDE","nome":"Tarde","horaInicio":"14:00","horaFim":"22:00","capacidadeMaxima":15,"diasSemana":["SEG","TER","QUA","QUI","SEX"],"ativo":true}
    ],
    "feriadosMunicipais": [],
    "teuMaximoSimultaneo": 560,
    "antecedenciaMinimaAgendamentoH": 24,
    "cancelamentoSemPenalidadeH": 4
  }'::jsonb
)
WHERE "tenant_id" = 'default';

ALTER TABLE "clientes"
ADD COLUMN IF NOT EXISTS "cancelamentos_tardios" INTEGER NOT NULL DEFAULT 0;
