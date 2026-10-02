-- Remove o ciclo TOS (containers_tos / event sourcing) e a tabela tarifária legada.
-- A view de BI deixa de ler avaria_records e passa a usar divergências do Gate-v2.

DROP MATERIALIZED VIEW IF EXISTS mv_frota_patio_status;

CREATE MATERIALIZED VIEW mv_frota_patio_status AS
SELECT status_label, unidades FROM (
  SELECT 'CHEIO'::text AS status_label, COUNT(DISTINCT pu.id)::int AS unidades
  FROM patio_v2_unidades pu
  INNER JOIN agendamentos_terminal a ON a."solicitacaoId" = pu.solicitacao_id
  WHERE pu.posicao_atual_id IS NOT NULL AND a.status_carga = 'CHEIO'::"StatusCarga"
  UNION ALL
  SELECT 'VAZIO', COUNT(DISTINCT pu.id)::int
  FROM patio_v2_unidades pu
  INNER JOIN agendamentos_terminal a ON a."solicitacaoId" = pu.solicitacao_id
  WHERE pu.posicao_atual_id IS NOT NULL AND a.status_carga = 'VAZIO'::"StatusCarga"
  UNION ALL
  SELECT 'AVARIADO', COUNT(DISTINCT pu.id)::int
  FROM patio_v2_unidades pu
  INNER JOIN gate_v2_check_ins g ON g.id = pu.gate_in_id
  WHERE pu.posicao_atual_id IS NOT NULL
    AND jsonb_typeof(g.divergencias_json) = 'array'
    AND jsonb_array_length(g.divergencias_json) > 0
  UNION ALL
  SELECT 'BLOQUEADO_MAPA_RECEITA', COUNT(DISTINCT u.id)::int
  FROM unidades_solicitacao u
  INNER JOIN patio_v2_unidades pu ON pu.solicitacao_id = u."solicitacaoId" AND pu.unidade_iso = u."numeroIso"
  WHERE u.movimentacao_bloqueada = true
    AND pu.posicao_atual_id IS NOT NULL
) x;

CREATE UNIQUE INDEX mv_frota_patio_status_label_uidx ON mv_frota_patio_status (status_label);

UPDATE outbox_events
SET
  status = 'FAILED',
  error_text = 'TOS billing removido — use o motor de armazenagem (pré-fatura / fatura).'
WHERE event_type = 'BILLING_TRIGGERED'
  AND status IN ('PENDING', 'PROCESSING');

DROP TABLE IF EXISTS avaria_records;
DROP TABLE IF EXISTS container_events;
DROP TABLE IF EXISTS containers_tos;
DROP TABLE IF EXISTS tabelas_tarifarias;

DROP TYPE IF EXISTS "MomentoAvaria";
DROP TYPE IF EXISTS "ContainerEventType";
DROP TYPE IF EXISTS "TipoContainerTos";
