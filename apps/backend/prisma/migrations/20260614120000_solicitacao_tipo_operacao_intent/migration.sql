-- CreateEnum
CREATE TYPE "TipoOperacaoSolicitacaoIntent" AS ENUM (
  'SOLICITAR_BAIXA',
  'SOLICITAR_IMPORTACAO_COLETA_DEPOT',
  'SOLICITAR_COLETA',
  'SOLICITAR_EXPORTACAO_ENTREGA_DEPOT'
);

-- AlterTable
ALTER TABLE "solicitacoes" ADD COLUMN "tipo_operacao" "TipoOperacaoSolicitacaoIntent";
