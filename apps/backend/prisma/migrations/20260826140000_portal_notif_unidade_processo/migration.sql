-- Inbox do portal: entrada/saída do ID da unidade.

ALTER TYPE "TipoNotificacaoPortal" ADD VALUE IF NOT EXISTS 'UNIDADE_PROCESSO_ABERTO';
ALTER TYPE "TipoNotificacaoPortal" ADD VALUE IF NOT EXISTS 'UNIDADE_PROCESSO_ENCERRADO';
