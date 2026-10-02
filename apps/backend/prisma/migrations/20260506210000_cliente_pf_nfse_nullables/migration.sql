-- PF: data de nascimento e flexibilidade fiscal (campos PJ opcionais quando tipo=PF no app).
ALTER TABLE "clientes" ADD COLUMN "data_nascimento" TIMESTAMP(3);

ALTER TABLE "clientes" ALTER COLUMN "regime_tributario" DROP NOT NULL;
ALTER TABLE "clientes" ALTER COLUMN "descricao_atividade" DROP NOT NULL;
ALTER TABLE "clientes" ALTER COLUMN "cnae" DROP NOT NULL;
ALTER TABLE "clientes" ALTER COLUMN "codigo_municipio_ibge" DROP NOT NULL;
ALTER TABLE "clientes" ALTER COLUMN "responsavel" DROP NOT NULL;
ALTER TABLE "clientes" ALTER COLUMN "responsavel_telefone" DROP NOT NULL;
ALTER TABLE "clientes" ALTER COLUMN "responsavel_email" DROP NOT NULL;
