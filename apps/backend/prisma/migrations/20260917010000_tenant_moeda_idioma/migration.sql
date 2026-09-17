ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "moeda_corrente" VARCHAR(8) NOT NULL DEFAULT 'BRL';
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "idioma_padrao" VARCHAR(16) NOT NULL DEFAULT 'pt-BR';

UPDATE "tenants" t
SET "moeda_corrente" = upper(tc.parametros->'empresa'->>'moedaCorrente')
FROM "tenant_configs" tc
WHERE tc.tenant_id = t.id
  AND upper(tc.parametros->'empresa'->>'moedaCorrente') IN (
    'BRL', 'USD', 'EUR', 'PYG', 'ARS', 'CLP', 'UYU', 'PEN', 'COP'
  );
