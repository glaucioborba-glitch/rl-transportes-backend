-- Refinamento Terminal FL (Glaucio, 28/07/2026) — PR-03, PR-10, PR-04/05/06 defaults

-- PR-03: status do contêiner na regra tarifária
ALTER TABLE "regras_tarifarias"
ADD COLUMN IF NOT EXISTS "status_container" TEXT NOT NULL DEFAULT 'AMBOS';

CREATE INDEX IF NOT EXISTS "idx_regras_tarifarias_composite"
ON "regras_tarifarias"("tabela_preco_id", "tipo_container", "status_container", "ativa");

-- PR-10: SLA em minutos (renomeia coluna legada)
ALTER TABLE "tenant_configs"
RENAME COLUMN "slas_horas_proxy" TO "slas_minutos_meta";

UPDATE "tenant_configs"
SET "slas_minutos_meta" = jsonb_build_object(
  'gate', COALESCE(("slas_minutos_meta"->>'gate')::int, 4) * 60,
  'patio', COALESCE(("slas_minutos_meta"->>'patio')::int, 72) * 60,
  'saida', COALESCE(("slas_minutos_meta"->>'saida')::int, 24) * 60
);

-- PR-04/05/06/07: defaults operacionais (merge JSONB)
UPDATE "tenant_configs"
SET "parametros" = jsonb_set(
  COALESCE("parametros", '{}'::jsonb),
  '{operacional}',
  COALESCE("parametros"->'operacional', '{}'::jsonb) || '{
    "turnos": [
      {"id":"t1","codigo":"T1","slot":"MANHA","nome":"Operacional Manhã","horaInicio":"07:00","horaFim":"14:00","capacidadeMaxima":8,"diasSemana":["SEG","TER","QUA","QUI","SEX"],"ativo":true},
      {"id":"t2","codigo":"T2","slot":"TARDE","nome":"Operacional Tarde","horaInicio":"14:00","horaFim":"20:00","capacidadeMaxima":7,"diasSemana":["SEG","TER","QUA","QUI","SEX"],"ativo":true},
      {"id":"t3","codigo":"T3","slot":"MANHA","nome":"Sábado Manhã","horaInicio":"07:00","horaFim":"12:00","capacidadeMaxima":5,"diasSemana":["SAB"],"ativo":true},
      {"id":"t4","codigo":"T4","slot":"TARDE","nome":"Sábado Tarde","horaInicio":"13:00","horaFim":"16:00","capacidadeMaxima":3,"diasSemana":["SAB"],"ativo":true}
    ],
    "tatAlvoEntradaMin": 120,
    "tatAlvoSaidaMin": 120,
    "tatAlvoRemocaoMin": 60,
    "toleranciaChegada": {"tipo":"dia","valorMin":0,"ativo":false},
    "antecedenciaMinimaMin": 60,
    "cancelamentoSemPenalidadeMin": 120,
    "validarAntecedenciaAgendamento": true,
    "validarCancelamentoSemPenalidade": true
  }'::jsonb
)
WHERE "tenant_id" = 'default';

-- PR-09: auditoria de atendimento especial
ALTER TABLE "agendamentos_solicitacao"
ADD COLUMN IF NOT EXISTS "atendimento_especial_audit" JSONB;
