ALTER TYPE "StatusSolicitacaoAluguel" ADD VALUE IF NOT EXISTS 'INICIADO';

ALTER TABLE "alugueis"
  ADD COLUMN "solicitacao_aluguel_id" TEXT;

CREATE INDEX "alugueis_solicitacao_aluguel_id_idx"
  ON "alugueis"("solicitacao_aluguel_id");

ALTER TABLE "alugueis"
  ADD CONSTRAINT "alugueis_solicitacao_aluguel_id_fkey"
  FOREIGN KEY ("solicitacao_aluguel_id") REFERENCES "solicitacoes_aluguel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
