-- BI / CQRS — Materialized Views para Torre de Controle e Visão Operacional.
-- Atualizadas a cada 15 min via BiAnalyticsCronService.

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_faturamento_diario AS
WITH dias AS (
  SELECT generate_series(
    (CURRENT_DATE - INTERVAL '89 days')::date,
    CURRENT_DATE,
    INTERVAL '1 day'
  )::date AS ref_dia
),
provision AS (
  SELECT DATE(p.updated_at) AS ref_dia, SUM(p.valor_acumulado)::numeric(14, 2) AS total
  FROM pre_faturas p
  WHERE p.status = 'ABERTA'::"StatusPreFatura"
  GROUP BY 1
),
faturado AS (
  SELECT DATE(f.created_at) AS ref_dia, SUM(f.valor_total)::numeric(14, 2) AS total
  FROM faturas_armazenagem f
  WHERE f.status_pagamento <> 'CANCELADO'::"StatusPagamentoFatura"
  GROUP BY 1
)
SELECT
  d.ref_dia,
  COALESCE(p.total, 0)::numeric(14, 2) AS receita_provisionada,
  COALESCE(f.total, 0)::numeric(14, 2) AS receita_faturada
FROM dias d
LEFT JOIN provision p ON p.ref_dia = d.ref_dia
LEFT JOIN faturado f ON f.ref_dia = d.ref_dia;

CREATE UNIQUE INDEX IF NOT EXISTS mv_faturamento_diario_ref_dia_uidx ON mv_faturamento_diario (ref_dia);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_financeiro_resumo AS
SELECT
  1 AS id,
  COALESCE(
    AVG(
      CASE
        WHEN f.status_pagamento = 'PAGO'::"StatusPagamentoFatura" AND f.updated_at IS NOT NULL
        THEN EXTRACT(DAY FROM (f.updated_at - f.created_at))
        ELSE NULL
      END
    ),
    0
  )::numeric(8, 2) AS dso_dias,
  COUNT(*) FILTER (
    WHERE f.status_pagamento IN (
      'PENDENTE'::"StatusPagamentoFatura",
      'PROCESSANDO'::"StatusPagamentoFatura",
      'AGUARDANDO_PAGAMENTO'::"StatusPagamentoFatura"
    )
  )::int AS faturas_abertas_qtd,
  COALESCE(
    SUM(f.valor_total) FILTER (
      WHERE f.status_pagamento IN (
        'PENDENTE'::"StatusPagamentoFatura",
        'PROCESSANDO'::"StatusPagamentoFatura",
        'AGUARDANDO_PAGAMENTO'::"StatusPagamentoFatura"
      )
    ),
    0
  )::numeric(14, 2) AS faturas_abertas_valor
FROM faturas_armazenagem f
WHERE f.status_pagamento <> 'CANCELADO'::"StatusPagamentoFatura";

CREATE UNIQUE INDEX IF NOT EXISTS mv_financeiro_resumo_id_uidx ON mv_financeiro_resumo (id);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_tat_gate AS
SELECT
  DATE(gi.data_hora) AS ref_dia,
  COUNT(*)::int AS ciclos,
  ROUND(AVG(EXTRACT(EPOCH FROM (go.data_hora - gi.data_hora)) / 60.0)::numeric, 2) AS tat_medio_minutos
FROM gate_v2_check_ins gi
INNER JOIN gate_v2_check_outs go ON go.gate_in_id = gi.id
GROUP BY 1;

CREATE UNIQUE INDEX IF NOT EXISTS mv_tat_gate_ref_dia_uidx ON mv_tat_gate (ref_dia);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_patio_ocupacao AS
SELECT
  1 AS id,
  COALESCE(SUM(pp.capacidade), 0)::int AS capacidade_total,
  COUNT(pu.id) FILTER (WHERE pu.posicao_atual_id IS NOT NULL)::int AS posicoes_ocupadas,
  GREATEST(
    COALESCE(SUM(pp.capacidade), 0) - COUNT(pu.id) FILTER (WHERE pu.posicao_atual_id IS NOT NULL),
    0
  )::int AS posicoes_livres
FROM patio_v2_posicoes pp
LEFT JOIN patio_v2_unidades pu ON pu.posicao_atual_id = pp.id;

CREATE UNIQUE INDEX IF NOT EXISTS mv_patio_ocupacao_id_uidx ON mv_patio_ocupacao (id);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_ocupacao_projetada_7d AS
WITH dias AS (
  SELECT generate_series(CURRENT_DATE, (CURRENT_DATE + INTERVAL '6 days')::date, INTERVAL '1 day')::date AS ref_dia
),
estoque AS (
  SELECT COUNT(*)::int AS unidades
  FROM patio_v2_unidades pu
  WHERE pu.posicao_atual_id IS NOT NULL
),
entradas AS (
  SELECT a.data_ref AS ref_dia, COUNT(*)::int AS qtd
  FROM agendamentos_terminal a
  WHERE a.status IN ('PENDENTE'::"StatusAgendamentoTerminal", 'CONFIRMADO'::"StatusAgendamentoTerminal")
    AND a.tipo_operacao = 'GATE_IN'::"TipoOperacaoAgendamento"
    AND a.data_ref BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '6 days')::date
  GROUP BY 1
),
saidas AS (
  SELECT a.data_ref AS ref_dia, COUNT(*)::int AS qtd
  FROM agendamentos_terminal a
  WHERE a.status IN ('PENDENTE'::"StatusAgendamentoTerminal", 'CONFIRMADO'::"StatusAgendamentoTerminal")
    AND a.tipo_operacao = 'GATE_OUT'::"TipoOperacaoAgendamento"
    AND a.data_ref BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '6 days')::date
  GROUP BY 1
)
SELECT
  d.ref_dia,
  (SELECT unidades FROM estoque) AS estoque_atual,
  COALESCE(e.qtd, 0) AS entradas_agendadas,
  COALESCE(s.qtd, 0) AS saidas_agendadas,
  GREATEST(
    (SELECT unidades FROM estoque)
    + SUM(COALESCE(e.qtd, 0) - COALESCE(s.qtd, 0)) OVER (ORDER BY d.ref_dia ROWS UNBOUNDED PRECEDING),
    0
  )::int AS ocupacao_projetada
FROM dias d
LEFT JOIN entradas e ON e.ref_dia = d.ref_dia
LEFT JOIN saidas s ON s.ref_dia = d.ref_dia;

CREATE UNIQUE INDEX IF NOT EXISTS mv_ocupacao_projetada_7d_ref_dia_uidx ON mv_ocupacao_projetada_7d (ref_dia);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_gate_heatmap AS
SELECT
  EXTRACT(DOW FROM a.data_ref)::int AS dia_semana,
  CASE a.turno
    WHEN 'MANHA'::"TurnoAgendamento" THEN 9
    WHEN 'TARDE'::"TurnoAgendamento" THEN 14
    ELSE 12
  END AS hora_ref,
  COUNT(*)::int AS agendamentos
FROM agendamentos_terminal a
WHERE a.status IN ('PENDENTE'::"StatusAgendamentoTerminal", 'CONFIRMADO'::"StatusAgendamentoTerminal")
  AND a.data_ref >= (CURRENT_DATE - INTERVAL '30 days')::date
GROUP BY 1, 2;

CREATE UNIQUE INDEX IF NOT EXISTS mv_gate_heatmap_dow_hora_uidx ON mv_gate_heatmap (dia_semana, hora_ref);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_frota_patio_status AS
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
  SELECT 'AVARIADO', COUNT(DISTINCT av.container_id)::int
  FROM avaria_records av
  INNER JOIN containers_tos c ON c.id = av.container_id
  INNER JOIN patio_v2_unidades pu ON pu.unidade_iso = c.numero AND pu.posicao_atual_id IS NOT NULL
  UNION ALL
  SELECT 'BLOQUEADO_MAPA_RECEITA', COUNT(DISTINCT u.id)::int
  FROM unidades_solicitacao u
  INNER JOIN patio_v2_unidades pu ON pu.solicitacao_id = u."solicitacaoId" AND pu.unidade_iso = u."numeroIso"
  WHERE u.movimentacao_bloqueada = true
    AND pu.posicao_atual_id IS NOT NULL
) x;

CREATE UNIQUE INDEX IF NOT EXISTS mv_frota_patio_status_label_uidx ON mv_frota_patio_status (status_label);
