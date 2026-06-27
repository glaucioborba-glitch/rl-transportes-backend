-- Outbox: status PROCESSING para claim atômico multi-instância
ALTER TYPE "OutboxEventStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
