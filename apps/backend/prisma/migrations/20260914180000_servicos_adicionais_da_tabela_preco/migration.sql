-- Serviços adicionais saem da tabela de preços (OPERACAO) e passam para
-- cadastros_servico_itens. Copia INSPECAO/REPARO/TRANSFERENCIA etc. e
-- apaga as linhas OPERACAO da tabela de preços.

INSERT INTO "cadastros_servico_itens" (
  "id",
  "tabela_id",
  "codigo",
  "nome",
  "valor",
  "unidade",
  "ativo",
  "efeito",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid()::text,
  s.id,
  src.codigo,
  COALESCE(NULLIF(op.nome, ''), src.codigo),
  src.valor,
  src.unidade,
  true,
  'NENHUM',
  NOW(),
  NOW()
FROM "cadastros_tabelas_servico" s
JOIN LATERAL (
  SELECT DISTINCT ON (UPPER(i."tipo_operacao_codigo"))
    UPPER(i."tipo_operacao_codigo") AS codigo,
    i."valor",
    i."unidade"
  FROM "cadastros_tabelas_preco_itens" i
  JOIN "cadastros_tabelas_preco" p ON p.id = i."tabela_id"
  WHERE i."categoria_item" = 'OPERACAO'
    AND UPPER(i."tipo_operacao_codigo") NOT IN (
      'ARMAZENAGEM',
      'BAIXA',
      'COLETA',
      'GATE_IN',
      'GATE_OUT',
      'HANDLING',
      'DIARIA_ARMAZENAGEM',
      'ENERGIA_REEFER',
      'TOMADA',
      'SHIFTING_EXTRA'
    )
    AND p."deleted_at" IS NULL
  ORDER BY
    UPPER(i."tipo_operacao_codigo"),
    (i."tipo_container_codigo" IS NULL OR i."tipo_container_codigo" IN ('', '*')) DESC,
    (i."container_tamanho" IS NULL OR i."container_tamanho" IN ('', '*')) DESC,
    i."updated_at" DESC
) src ON true
LEFT JOIN LATERAL (
  SELECT nome
  FROM "cadastros_tipos_operacao"
  WHERE UPPER("codigo") = src.codigo
    AND "deleted_at" IS NULL
  LIMIT 1
) op ON true
WHERE s."deleted_at" IS NULL
  AND s."padrao" = true
  AND s."ativo" = true
  AND NOT EXISTS (
    SELECT 1
    FROM "cadastros_servico_itens" e
    WHERE e."tabela_id" = s.id
      AND e."codigo" = src.codigo
      AND e."deleted_at" IS NULL
  );

DELETE FROM "cadastros_tabelas_preco_itens"
WHERE "categoria_item" = 'OPERACAO';
