-- SaaS Multi-Tenant: tenants, tenant_id RLS columns, parametros JSONB, billing engine

CREATE TYPE "TenantStatus" AS ENUM ('ATIVO', 'BLOQUEADO', 'SUSPENSO');
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

CREATE TABLE "tenants" (
    "id" VARCHAR(64) NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ATIVO',
    "plano" VARCHAR(32) NOT NULL DEFAULT 'STANDARD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");
CREATE INDEX "tenants_status_idx" ON "tenants"("status");

INSERT INTO "tenants" ("id", "slug", "nome", "status", "plano", "updated_at")
VALUES ('default', 'default', 'Terminal corporativo (default)', 'ATIVO', 'STANDARD', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- tenant_configs: link to tenants + parametros
ALTER TABLE "tenant_configs" ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(64);
ALTER TABLE "tenant_configs" ADD COLUMN IF NOT EXISTS "parametros" JSONB NOT NULL DEFAULT '{}';

UPDATE "tenant_configs" SET "tenant_id" = "tenant_key" WHERE "tenant_id" IS NULL;

UPDATE "tenant_configs" SET "parametros" = jsonb_build_object(
  'branding', jsonb_build_object('corPrimaria', '#14b8a6'),
  'operacao', jsonb_build_object(
    'turnos', jsonb_build_array(
      jsonb_build_object('id', 'MANHA', 'nome', 'Manhã', 'inicio', '06:00', 'fim', '14:00'),
      jsonb_build_object('id', 'TARDE', 'nome', 'Tarde', 'inicio', '14:00', 'fim', '22:00')
    ),
    'exigeInspecaoGateIn', true,
    'diasFreeTimePadrao', 7
  )
) WHERE "parametros" = '{}'::jsonb;

ALTER TABLE "tenant_configs" ALTER COLUMN "tenant_id" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_configs_tenant_id_key" ON "tenant_configs"("tenant_id");
ALTER TABLE "tenant_configs" ADD CONSTRAINT "tenant_configs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- users tenant_id + composite uniques
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default';
UPDATE "users" SET "tenant_id" = 'default' WHERE "tenant_id" IS NULL;
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_cpf_cnpj_key";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_key";
CREATE UNIQUE INDEX IF NOT EXISTS "users_tenant_id_cpf_cnpj_key" ON "users"("tenant_id", "cpf_cnpj");
CREATE UNIQUE INDEX IF NOT EXISTS "users_tenant_id_email_key" ON "users"("tenant_id", "email");
CREATE INDEX IF NOT EXISTS "users_tenant_id_idx" ON "users"("tenant_id");
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- clientes
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default';
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "tabela_preco_id" TEXT;
UPDATE "clientes" SET "tenant_id" = 'default' WHERE "tenant_id" IS NULL;
ALTER TABLE "clientes" DROP CONSTRAINT IF EXISTS "clientes_cpfCnpj_key";
ALTER TABLE "clientes" DROP CONSTRAINT IF EXISTS "clientes_cpf_cnpj_key";
ALTER TABLE "clientes" DROP CONSTRAINT IF EXISTS "clientes_email_key";
CREATE UNIQUE INDEX IF NOT EXISTS "clientes_tenant_id_cpf_cnpj_key" ON "clientes"("tenant_id", "cpfCnpj");
CREATE UNIQUE INDEX IF NOT EXISTS "clientes_tenant_id_email_key" ON "clientes"("tenant_id", "email");
CREATE INDEX IF NOT EXISTS "clientes_tenant_id_idx" ON "clientes"("tenant_id");
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- solicitacoes
ALTER TABLE "solicitacoes" ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default';
UPDATE "solicitacoes" SET "tenant_id" = 'default' WHERE "tenant_id" IS NULL;
CREATE INDEX IF NOT EXISTS "solicitacoes_tenant_id_idx" ON "solicitacoes"("tenant_id");
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- audit_logs
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default';
UPDATE "audit_logs" SET "tenant_id" = 'default' WHERE "tenant_id" IS NULL;
CREATE INDEX IF NOT EXISTS "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id");
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- funcionarios
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default';
UPDATE "funcionarios" SET "tenant_id" = 'default' WHERE "tenant_id" IS NULL;
ALTER TABLE "funcionarios" DROP CONSTRAINT IF EXISTS "funcionarios_cpf_key";
CREATE UNIQUE INDEX IF NOT EXISTS "funcionarios_tenant_id_cpf_key" ON "funcionarios"("tenant_id", "cpf");
CREATE INDEX IF NOT EXISTS "funcionarios_tenant_id_idx" ON "funcionarios"("tenant_id");
ALTER TABLE "funcionarios" ADD CONSTRAINT "funcionarios_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- gate check-ins
ALTER TABLE "gate_v2_check_ins" ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default';
UPDATE "gate_v2_check_ins" SET "tenant_id" = 'default' WHERE "tenant_id" IS NULL;
CREATE INDEX IF NOT EXISTS "gate_v2_check_ins_tenant_id_idx" ON "gate_v2_check_ins"("tenant_id");
ALTER TABLE "gate_v2_check_ins" ADD CONSTRAINT "gate_v2_check_ins_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- agendamentos_terminal
ALTER TABLE "agendamentos_terminal" ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default';
UPDATE "agendamentos_terminal" SET "tenant_id" = 'default' WHERE "tenant_id" IS NULL;
CREATE INDEX IF NOT EXISTS "agendamentos_terminal_tenant_id_idx" ON "agendamentos_terminal"("tenant_id");
ALTER TABLE "agendamentos_terminal" ADD CONSTRAINT "agendamentos_terminal_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- faturamentos
ALTER TABLE "faturamentos" ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default';
UPDATE "faturamentos" SET "tenant_id" = 'default' WHERE "tenant_id" IS NULL;
CREATE INDEX IF NOT EXISTS "faturamentos_tenant_id_idx" ON "faturamentos"("tenant_id");
ALTER TABLE "faturamentos" ADD CONSTRAINT "faturamentos_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- faturas_armazenagem
ALTER TABLE "faturas_armazenagem" ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default';
UPDATE "faturas_armazenagem" SET "tenant_id" = 'default' WHERE "tenant_id" IS NULL;
CREATE INDEX IF NOT EXISTS "faturas_armazenagem_tenant_id_idx" ON "faturas_armazenagem"("tenant_id");
ALTER TABLE "faturas_armazenagem" ADD CONSTRAINT "faturas_armazenagem_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- billing engine tables
CREATE TABLE "tabelas_preco" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tabelas_preco_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tabelas_preco_tenant_id_ativa_idx" ON "tabelas_preco"("tenant_id", "ativa");
ALTER TABLE "tabelas_preco" ADD CONSTRAINT "tabelas_preco_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "regras_tarifarias" (
    "id" TEXT NOT NULL,
    "tabela_preco_id" TEXT NOT NULL,
    "nome" VARCHAR(120) NOT NULL DEFAULT 'Padrão',
    "valor_gate_in" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valor_gate_out" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valor_diaria" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "free_time_dias" INTEGER NOT NULL DEFAULT 7,
    "fator_reefer" DECIMAL(5,2) NOT NULL DEFAULT 2,
    "fator_imo" DECIMAL(5,2) NOT NULL DEFAULT 1.5,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "regras_tarifarias_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "regras_tarifarias_tabela_preco_id_ativa_idx" ON "regras_tarifarias"("tabela_preco_id", "ativa");
ALTER TABLE "regras_tarifarias" ADD CONSTRAINT "regras_tarifarias_tabela_preco_id_fkey"
  FOREIGN KEY ("tabela_preco_id") REFERENCES "tabelas_preco"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "clientes" ADD CONSTRAINT "clientes_tabela_preco_id_fkey"
  FOREIGN KEY ("tabela_preco_id") REFERENCES "tabelas_preco"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "clientes_tabela_preco_id_idx" ON "clientes"("tabela_preco_id");
