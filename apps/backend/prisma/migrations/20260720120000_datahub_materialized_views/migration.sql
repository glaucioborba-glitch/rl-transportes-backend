-- Datahub DW — materialized views (fonte persistente pós-restart).
-- Atualizadas via DatahubMvRefreshService / CRON a cada 15 min.

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_datahub_fato_solicitacoes AS
SELECT
  s.id,
  s.tenant_id,
  s.protocolo,
  s."clienteId" AS cliente_id,
  s.status::text AS status,
  s."createdAt" AS created_at,
  s."updatedAt" AS updated_at,
  COUNT(u.id)::int AS qt_unidades,
  bool_or(p.id IS NOT NULL) AS has_portaria,
  bool_or(g.id IS NOT NULL) AS has_gate,
  bool_or(gci.id IS NOT NULL) AS has_gate_v2,
  bool_or(pat.id IS NOT NULL) AS has_patio,
  bool_or(pu.id IS NOT NULL) AS has_patio_v2,
  bool_or(sa.id IS NOT NULL) AS has_saida
FROM solicitacoes s
LEFT JOIN unidades_solicitacao u ON u."solicitacaoId" = s.id
LEFT JOIN portarias p ON p."solicitacaoId" = s.id
LEFT JOIN gates g ON g."solicitacaoId" = s.id
LEFT JOIN gate_v2_check_ins gci ON gci."solicitacaoId" = s.id
LEFT JOIN patios pat ON pat."solicitacaoId" = s.id
LEFT JOIN patio_v2_unidades pu ON pu.solicitacao_id = s.id
LEFT JOIN saidas sa ON sa."solicitacaoId" = s.id
WHERE s."deletedAt" IS NULL
GROUP BY s.id, s.tenant_id, s.protocolo, s."clienteId", s.status, s."createdAt", s."updatedAt";

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dh_sol_id ON mv_datahub_fato_solicitacoes (id);
CREATE INDEX IF NOT EXISTS idx_mv_dh_sol_tenant ON mv_datahub_fato_solicitacoes (tenant_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_datahub_fato_gate AS
SELECT
  g.id,
  g."solicitacaoId" AS solicitacao_id,
  s.tenant_id,
  s."clienteId" AS cliente_id,
  g."ricAssinado" AS ric_assinado,
  g."createdAt" AS created_at,
  g."updatedAt" AS updated_at,
  'LEGACY'::text AS origem
FROM gates g
INNER JOIN solicitacoes s ON s.id = g."solicitacaoId"
WHERE s."deletedAt" IS NULL
UNION ALL
SELECT
  gci.id,
  gci."solicitacaoId" AS solicitacao_id,
  gci.tenant_id,
  s."clienteId" AS cliente_id,
  false AS ric_assinado,
  gci.data_hora AS created_at,
  gci.data_hora AS updated_at,
  'V2'::text AS origem
FROM gate_v2_check_ins gci
INNER JOIN solicitacoes s ON s.id = gci."solicitacaoId"
WHERE s."deletedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dh_gate_id ON mv_datahub_fato_gate (id);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_datahub_fato_patio AS
SELECT
  p.id,
  p."solicitacaoId" AS solicitacao_id,
  s.tenant_id,
  s."clienteId" AS cliente_id,
  p.quadra,
  p.fileira,
  p.posicao,
  p."createdAt" AS created_at,
  'LEGACY'::text AS origem
FROM patios p
INNER JOIN solicitacoes s ON s.id = p."solicitacaoId"
WHERE s."deletedAt" IS NULL
UNION ALL
SELECT
  pu.id,
  pu.solicitacao_id,
  s.tenant_id,
  s."clienteId" AS cliente_id,
  NULL::text AS quadra,
  NULL::text AS fileira,
  pp.codigo_baia AS posicao,
  pu.created_at,
  'V2'::text AS origem
FROM patio_v2_unidades pu
INNER JOIN solicitacoes s ON s.id = pu.solicitacao_id
LEFT JOIN patio_v2_posicoes pp ON pp.id = pu.posicao_atual_id
WHERE s."deletedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dh_patio_id ON mv_datahub_fato_patio (id);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_datahub_fato_saida AS
SELECT
  sa.id,
  sa."solicitacaoId" AS solicitacao_id,
  s.tenant_id,
  s."clienteId" AS cliente_id,
  sa."dataHoraSaida" AS data_hora_saida,
  sa."createdAt" AS created_at,
  GREATEST(
    0,
    EXTRACT(EPOCH FROM (sa."dataHoraSaida" - s."createdAt")) / 60.0
  )::numeric(12, 2) AS duracao_minutos
FROM saidas sa
INNER JOIN solicitacoes s ON s.id = sa."solicitacaoId"
WHERE s."deletedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dh_saida_id ON mv_datahub_fato_saida (id);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_datahub_fato_faturamento AS
SELECT
  f.id,
  f.tenant_id,
  f."clienteId" AS cliente_id,
  f.periodo,
  f."valorTotal" AS valor_total,
  f."createdAt" AS created_at,
  COUNT(fi.id)::int AS qt_itens
FROM faturamentos f
LEFT JOIN faturamento_itens fi ON fi."faturamentoId" = f.id
GROUP BY f.id, f.tenant_id, f."clienteId", f.periodo, f."valorTotal", f."createdAt";

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dh_fat_id ON mv_datahub_fato_faturamento (id);
CREATE INDEX IF NOT EXISTS idx_mv_dh_fat_tenant ON mv_datahub_fato_faturamento (tenant_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_datahub_fato_boletos AS
SELECT
  b.id,
  f.tenant_id,
  f."clienteId" AS cliente_id,
  b."valorBoleto" AS valor_boleto,
  b."dataVencimento" AS data_vencimento,
  b."statusPagamento" AS status_pagamento,
  CASE
    WHEN b."statusPagamento" <> 'PAGO' AND b."dataVencimento" < NOW() THEN true
    ELSE false
  END AS flag_vencido,
  b."createdAt" AS created_at
FROM boletos b
INNER JOIN faturamentos f ON f.id = b."faturamentoId";

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dh_bol_id ON mv_datahub_fato_boletos (id);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_datahub_fato_nfse AS
SELECT
  n.id,
  f.tenant_id,
  f."clienteId" AS cliente_id,
  n."faturamentoId" AS faturamento_id,
  n."statusIpm" AS status_ipm,
  n."createdAt" AS created_at
FROM nfs_emitidas n
INNER JOIN faturamentos f ON f.id = n."faturamentoId";

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dh_nfse_id ON mv_datahub_fato_nfse (id);
