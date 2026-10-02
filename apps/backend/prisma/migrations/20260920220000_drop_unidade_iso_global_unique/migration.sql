-- A coleta/saída cria Unidade na nova solicitação com o mesmo ISO da entrada.
-- O unique global em numeroIso (legado 20260416) sobreviveu ao DROP de 20260826 neste banco.
DROP INDEX IF EXISTS "unidades_solicitacao_numeroIso_key";
ALTER TABLE "unidades_solicitacao" DROP CONSTRAINT IF EXISTS "unidades_solicitacao_numeroIso_key";
