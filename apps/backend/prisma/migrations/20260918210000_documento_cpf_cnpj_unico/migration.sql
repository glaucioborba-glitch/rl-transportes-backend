-- CPF/CNPJ único por tenant nas tabelas de cadastro (inclusive catálogo de pré-preenchimento).
-- NULL não entra na unicidade (PostgreSQL).

UPDATE "colaborador_familiares"
SET "cpf" = NULL
WHERE "cpf" IS NOT NULL AND btrim("cpf") = '';

UPDATE "cadastros_bancos"
SET "cnpj" = NULL
WHERE "cnpj" IS NOT NULL AND btrim("cnpj") = '';

CREATE UNIQUE INDEX "tesouraria_fornecedores_tenant_id_cnpj_key"
  ON "tesouraria_fornecedores"("tenant_id", "cnpj");

CREATE UNIQUE INDEX "folha_colaboradores_rh_tenant_id_cpf_key"
  ON "folha_colaboradores_rh"("tenant_id", "cpf");

CREATE UNIQUE INDEX "cadastros_bancos_tenant_id_cnpj_key"
  ON "cadastros_bancos"("tenant_id", "cnpj");

CREATE UNIQUE INDEX "colaborador_familiares_tenant_id_cpf_key"
  ON "colaborador_familiares"("tenant_id", "cpf");
