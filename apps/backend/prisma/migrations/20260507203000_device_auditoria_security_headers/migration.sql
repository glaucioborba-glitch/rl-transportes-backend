-- Contexto de sessão e snapshot dos headers x-device-* para auditoria antifraude.
ALTER TABLE "device_auditorias" ADD COLUMN "session_id" VARCHAR(128);
ALTER TABLE "device_auditorias" ADD COLUMN "security_headers" JSONB;
