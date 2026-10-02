-- Protocolo da solicitação passa a ser sequência numerada (1, 2, 3…).
-- Protocolos antigos RL-AAAA-HEX permanecem; a sequência só considera valores numéricos.

CREATE SEQUENCE IF NOT EXISTS solicitacoes_protocolo_seq START WITH 1 INCREMENT BY 1;

DO $$
DECLARE
  n bigint;
BEGIN
  SELECT COALESCE(MAX(protocolo::bigint), 0)
    INTO n
    FROM solicitacoes
   WHERE protocolo ~ '^[0-9]+$';
  IF n > 0 THEN
    PERFORM setval('solicitacoes_protocolo_seq', n, true);
  ELSE
    PERFORM setval('solicitacoes_protocolo_seq', 1, false);
  END IF;
END $$;
