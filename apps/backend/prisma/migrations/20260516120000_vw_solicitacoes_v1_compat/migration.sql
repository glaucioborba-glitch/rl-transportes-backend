-- View de compatibilidade: expõe rótulos "status v2" (APROVADA, REJEITADA, …) sem alterar o enum físico em `solicitacoes`.
-- Relatórios legados continuam usando a coluna `solicitacoes.status`; novos relatórios podem usar `statusV2Label`.

CREATE OR REPLACE VIEW vw_solicitacoes_v1_compat AS
SELECT
  s.id,
  s.protocolo,
  s."clienteId" AS "clienteId",
  s.status::text AS "statusDb",
  CASE s.status::text
    WHEN 'APROVADO' THEN 'APROVADA'
    WHEN 'REJEITADO' THEN 'REJEITADA'
    WHEN 'CONCLUIDO' THEN 'CONCLUIDA'
    WHEN 'CANCELADO' THEN 'CANCELADA'
    WHEN 'EM_ANALISE' THEN 'EM_ANALISE'
    WHEN 'EM_EXECUCAO' THEN 'EM_EXECUCAO'
    WHEN 'PENDENTE' THEN 'PENDENTE'
    ELSE s.status::text
  END AS "statusV2Label",
  s."createdAt" AS "createdAt",
  s."updatedAt" AS "updatedAt",
  t.tipo_caminhao::text AS "tipoCaminhao",
  (
    SELECT COUNT(*)::int
    FROM containers_solicitacao c
    WHERE c."solicitacaoId" = s.id
  ) AS "qtdContainers",
  EXISTS (
    SELECT 1 FROM transporte_solicitacao ts WHERE ts."solicitacaoId" = s.id
  ) AS "isFluxoCorporativoV2"
FROM solicitacoes s
LEFT JOIN transporte_solicitacao t ON t."solicitacaoId" = s.id
WHERE s."deletedAt" IS NULL;
