ALTER TYPE "EventoGatilhoTarifa" ADD VALUE IF NOT EXISTS 'SERVICO_ADICIONAL';
ALTER TYPE "EventoGatilhoTarifa" ADD VALUE IF NOT EXISTS 'FRETE';

CREATE TABLE "cadastros_tabelas_servico" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "nome" VARCHAR(255) NOT NULL,
  "descricao" TEXT,
  "data_inicio" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "data_fim" DATE,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "padrao" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "cadastros_tabelas_servico_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cadastros_servico_itens" (
  "id" TEXT NOT NULL,
  "tabela_id" TEXT NOT NULL,
  "codigo" VARCHAR(32) NOT NULL,
  "nome" VARCHAR(120) NOT NULL,
  "valor" DECIMAL(12,2) NOT NULL,
  "unidade" VARCHAR(32) NOT NULL DEFAULT 'POR_UNIDADE',
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "cadastros_servico_itens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "unidade_processo_servicos" (
  "id" TEXT NOT NULL,
  "unidade_processo_id" TEXT NOT NULL,
  "cadastro_servico_item_id" TEXT,
  "codigo" VARCHAR(32) NOT NULL,
  "nome" VARCHAR(120) NOT NULL,
  "quantidade" DECIMAL(10,2) NOT NULL,
  "valor_unitario" DECIMAL(12,2) NOT NULL,
  "valor_total" DECIMAL(12,2) NOT NULL,
  "lancado_por_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "unidade_processo_servicos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cadastros_tabelas_servico_tenant_id_ativo_idx" ON "cadastros_tabelas_servico"("tenant_id", "ativo");
CREATE INDEX "cadastros_tabelas_servico_tenant_id_padrao_idx" ON "cadastros_tabelas_servico"("tenant_id", "padrao");
CREATE UNIQUE INDEX "cadastros_servico_itens_tabela_id_codigo_key" ON "cadastros_servico_itens"("tabela_id", "codigo");
CREATE INDEX "cadastros_servico_itens_tabela_id_ativo_idx" ON "cadastros_servico_itens"("tabela_id", "ativo");
CREATE INDEX "unidade_processo_servicos_unidade_processo_id_idx" ON "unidade_processo_servicos"("unidade_processo_id");

ALTER TABLE "cadastros_tabelas_servico" ADD CONSTRAINT "cadastros_tabelas_servico_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cadastros_servico_itens" ADD CONSTRAINT "cadastros_servico_itens_tabela_id_fkey"
  FOREIGN KEY ("tabela_id") REFERENCES "cadastros_tabelas_servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "unidade_processo_servicos" ADD CONSTRAINT "unidade_processo_servicos_unidade_processo_id_fkey"
  FOREIGN KEY ("unidade_processo_id") REFERENCES "unidade_processos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "unidade_processo_servicos" ADD CONSTRAINT "unidade_processo_servicos_cadastro_servico_item_id_fkey"
  FOREIGN KEY ("cadastro_servico_item_id") REFERENCES "cadastros_servico_itens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
