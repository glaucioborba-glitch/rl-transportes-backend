-- C-07: incluir faturas VENCIDA no resumo financeiro BI + refresh inicial

DROP MATERIALIZED VIEW IF EXISTS mv_financeiro_resumo;

CREATE MATERIALIZED VIEW mv_financeiro_resumo AS
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
      'AGUARDANDO_PAGAMENTO'::"StatusPagamentoFatura",
      'VENCIDA'::"StatusPagamentoFatura"
    )
  )::int AS faturas_abertas_qtd,
  COALESCE(
    SUM(f.valor_total) FILTER (
      WHERE f.status_pagamento IN (
        'PENDENTE'::"StatusPagamentoFatura",
        'PROCESSANDO'::"StatusPagamentoFatura",
        'AGUARDANDO_PAGAMENTO'::"StatusPagamentoFatura",
        'VENCIDA'::"StatusPagamentoFatura"
      )
    ),
    0
  )::numeric(14, 2) AS faturas_abertas_valor
FROM faturas_armazenagem f
WHERE f.status_pagamento <> 'CANCELADO'::"StatusPagamentoFatura";

CREATE UNIQUE INDEX IF NOT EXISTS mv_financeiro_resumo_id_uidx ON mv_financeiro_resumo (id);

REFRESH MATERIALIZED VIEW mv_financeiro_resumo;
