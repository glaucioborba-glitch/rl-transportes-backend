-- Tabelas de serviços e de aluguel atribuídas a cada cliente (como transportes).
ALTER TABLE "clientes"
  ADD COLUMN "cadastro_tabela_servico_id" TEXT,
  ADD COLUMN "cadastro_tabela_aluguel_id" TEXT;

CREATE INDEX "clientes_cadastro_tabela_servico_id_idx" ON "clientes"("cadastro_tabela_servico_id");
CREATE INDEX "clientes_cadastro_tabela_aluguel_id_idx" ON "clientes"("cadastro_tabela_aluguel_id");

ALTER TABLE "clientes"
  ADD CONSTRAINT "clientes_cadastro_tabela_servico_id_fkey"
  FOREIGN KEY ("cadastro_tabela_servico_id") REFERENCES "cadastros_tabelas_servico"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "clientes"
  ADD CONSTRAINT "clientes_cadastro_tabela_aluguel_id_fkey"
  FOREIGN KEY ("cadastro_tabela_aluguel_id") REFERENCES "cadastros_tabelas_aluguel"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "clientes" c
SET "cadastro_tabela_servico_id" = (
  SELECT t.id FROM "cadastros_tabelas_servico" t
  WHERE t.deleted_at IS NULL AND t.ativo = true AND t.tenant_id = c.tenant_id
  ORDER BY t.padrao DESC, t.data_inicio DESC
  LIMIT 1
)
WHERE c."deletedAt" IS NULL AND c."cadastro_tabela_servico_id" IS NULL;

UPDATE "clientes" c
SET "cadastro_tabela_aluguel_id" = (
  SELECT t.id FROM "cadastros_tabelas_aluguel" t
  WHERE t.deleted_at IS NULL AND t.ativo = true AND t.tenant_id = c.tenant_id
  ORDER BY t.padrao DESC, t.data_inicio DESC
  LIMIT 1
)
WHERE c."deletedAt" IS NULL AND c."cadastro_tabela_aluguel_id" IS NULL;
