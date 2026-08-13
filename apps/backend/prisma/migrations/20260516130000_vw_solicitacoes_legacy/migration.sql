-- Alias de relatório: mesmas colunas que `vw_solicitacoes_v1_compat` (depende dessa view).
CREATE OR REPLACE VIEW vw_solicitacoes_legacy AS
SELECT * FROM vw_solicitacoes_v1_compat;
