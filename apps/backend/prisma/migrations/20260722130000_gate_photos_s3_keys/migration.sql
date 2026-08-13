-- Gate v2 — chaves S3 para cleanup (fotos_entrada/saida contêm URLs http(s), não base64)

ALTER TABLE "gate_v2_check_ins" ADD COLUMN IF NOT EXISTS "fotos_entrada_keys" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "gate_v2_check_outs" ADD COLUMN IF NOT EXISTS "fotos_saida_keys" JSONB NOT NULL DEFAULT '{}';
