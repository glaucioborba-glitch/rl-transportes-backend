-- Billing engine hardening: novos intents + evento energia reefer
ALTER TYPE "TipoOperacaoSolicitacaoIntent" ADD VALUE IF NOT EXISTS 'SOLICITAR_TRANSFERENCIA';
ALTER TYPE "TipoOperacaoSolicitacaoIntent" ADD VALUE IF NOT EXISTS 'SOLICITAR_INSPECAO';
ALTER TYPE "TipoOperacaoSolicitacaoIntent" ADD VALUE IF NOT EXISTS 'SOLICITAR_REPARO';

ALTER TYPE "EventoGatilhoTarifa" ADD VALUE IF NOT EXISTS 'ENERGIA_REEFER';
