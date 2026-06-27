-- NFS-e: cadastro fiscal completo + regime tributário.

CREATE TYPE "RegimeTributario" AS ENUM ('MEI', 'SimplesNacional', 'LucroPresumido', 'LucroReal');

ALTER TABLE "clientes" ADD COLUMN "nome_fantasia" VARCHAR(255);
ALTER TABLE "clientes" ADD COLUMN "inscricao_municipal" VARCHAR(32);
ALTER TABLE "clientes" ADD COLUMN "inscricao_estadual" VARCHAR(32);
ALTER TABLE "clientes" ADD COLUMN "isento_ie" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clientes" ADD COLUMN "email_nfse" VARCHAR(255);
ALTER TABLE "clientes" ADD COLUMN "endereco_logradouro" VARCHAR(255);
ALTER TABLE "clientes" ADD COLUMN "endereco_numero" VARCHAR(20);
ALTER TABLE "clientes" ADD COLUMN "endereco_complemento" VARCHAR(120);
ALTER TABLE "clientes" ADD COLUMN "endereco_bairro" VARCHAR(120);
ALTER TABLE "clientes" ADD COLUMN "endereco_cidade" VARCHAR(120);
ALTER TABLE "clientes" ADD COLUMN "endereco_uf" VARCHAR(2);
ALTER TABLE "clientes" ADD COLUMN "endereco_cep" VARCHAR(8);
ALTER TABLE "clientes" ADD COLUMN "codigo_municipio_ibge" VARCHAR(7);
ALTER TABLE "clientes" ADD COLUMN "regime_tributario" "RegimeTributario";
ALTER TABLE "clientes" ADD COLUMN "descricao_atividade" VARCHAR(500);
ALTER TABLE "clientes" ADD COLUMN "cnae" VARCHAR(7);
ALTER TABLE "clientes" ADD COLUMN "responsavel" VARCHAR(255);
ALTER TABLE "clientes" ADD COLUMN "responsavel_telefone" VARCHAR(20);
ALTER TABLE "clientes" ADD COLUMN "responsavel_email" VARCHAR(255);

UPDATE "clientes" SET
  "email_nfse" = "email",
  "endereco_logradouro" = CASE
    WHEN "endereco" IS NOT NULL AND trim("endereco") <> '' THEN left(trim("endereco"), 255)
    ELSE 'A definir'
  END,
  "endereco_numero" = 'S/N',
  "endereco_bairro" = 'A definir',
  "endereco_cidade" = 'A definir',
  "endereco_uf" = 'SC',
  "endereco_cep" = '00000000',
  "codigo_municipio_ibge" = '4211306',
  "regime_tributario" = 'SimplesNacional',
  "descricao_atividade" = 'A definir conforme contrato',
  "cnae" = '4930202',
  "responsavel" = 'A definir',
  "responsavel_email" = "email",
  "responsavel_telefone" = CASE
    WHEN "telefone" IS NOT NULL AND trim("telefone") <> ''
    THEN left(regexp_replace("telefone", '\D', '', 'g'), 20)
    ELSE '00000000000'
  END;

UPDATE "clientes" SET "telefone" = '00000000000' WHERE "telefone" IS NULL OR trim(COALESCE("telefone", '')) = '';

UPDATE "clientes" SET "telefone" = left(regexp_replace("telefone", '\D', '', 'g'), 20) WHERE "telefone" IS NOT NULL;

ALTER TABLE "clientes" ALTER COLUMN "email_nfse" SET NOT NULL;
ALTER TABLE "clientes" ALTER COLUMN "endereco_logradouro" SET NOT NULL;
ALTER TABLE "clientes" ALTER COLUMN "endereco_numero" SET NOT NULL;
ALTER TABLE "clientes" ALTER COLUMN "endereco_bairro" SET NOT NULL;
ALTER TABLE "clientes" ALTER COLUMN "endereco_cidade" SET NOT NULL;
ALTER TABLE "clientes" ALTER COLUMN "endereco_uf" SET NOT NULL;
ALTER TABLE "clientes" ALTER COLUMN "endereco_cep" SET NOT NULL;
ALTER TABLE "clientes" ALTER COLUMN "codigo_municipio_ibge" SET NOT NULL;
ALTER TABLE "clientes" ALTER COLUMN "regime_tributario" SET NOT NULL;
ALTER TABLE "clientes" ALTER COLUMN "descricao_atividade" SET NOT NULL;
ALTER TABLE "clientes" ALTER COLUMN "cnae" SET NOT NULL;
ALTER TABLE "clientes" ALTER COLUMN "responsavel" SET NOT NULL;
ALTER TABLE "clientes" ALTER COLUMN "responsavel_telefone" SET NOT NULL;
ALTER TABLE "clientes" ALTER COLUMN "responsavel_email" SET NOT NULL;

ALTER TABLE "clientes" ALTER COLUMN "telefone" SET NOT NULL;
ALTER TABLE "clientes" ALTER COLUMN "telefone" TYPE VARCHAR(20) USING left(trim("telefone"), 20);

ALTER TABLE "clientes" DROP COLUMN "endereco";
