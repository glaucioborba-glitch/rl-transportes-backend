-- Reclaim de outbox travado passa a usar o instante do claim, não a criação do evento.
-- Sem isso, emissão fiscal lenta (>5 min) era reprocessada em paralelo e gerava nota/boleto duplicados.
ALTER TABLE "outbox_events" ADD COLUMN IF NOT EXISTS "claimed_at" TIMESTAMP(3);

-- Eventos já em processamento herdam a criação como referência, para não serem reclamados na hora.
UPDATE "outbox_events" SET "claimed_at" = "created_at" WHERE "status" = 'PROCESSING' AND "claimed_at" IS NULL;

CREATE INDEX IF NOT EXISTS "outbox_events_status_claimed_at_idx" ON "outbox_events" ("status", "claimed_at");
