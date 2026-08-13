-- PR-001: Persist in-memory stores to PostgreSQL

-- GRC Compliance
CREATE TABLE "grc_riscos" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "titulo" VARCHAR(255) NOT NULL,
  "descricao" TEXT NOT NULL,
  "categoria" VARCHAR(120) NOT NULL,
  "probabilidade" INTEGER NOT NULL DEFAULT 3,
  "impacto" INTEGER NOT NULL DEFAULT 3,
  "severidade" INTEGER NOT NULL DEFAULT 9,
  "status" VARCHAR(60) NOT NULL DEFAULT 'aberto',
  "responsavel" VARCHAR(255) NOT NULL,
  "origem" VARCHAR(120) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "grc_riscos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_grc_riscos_tenant" ON "grc_riscos"("tenant_id");

CREATE TABLE "grc_controles" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "risco_relacionado_id" TEXT NOT NULL,
  "nome_controle" VARCHAR(255) NOT NULL,
  "frequencia" VARCHAR(60) NOT NULL,
  "responsavel" VARCHAR(255) NOT NULL,
  "evidencia" TEXT,
  "eficacia" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "grc_controles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "grc_controles_risco_fkey" FOREIGN KEY ("risco_relacionado_id") REFERENCES "grc_riscos"("id") ON DELETE CASCADE
);
CREATE INDEX "idx_grc_controles_tenant" ON "grc_controles"("tenant_id");

CREATE TABLE "grc_planos_acao" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "what" TEXT NOT NULL,
  "why" TEXT NOT NULL,
  "where" TEXT NOT NULL,
  "when" TEXT NOT NULL,
  "who" TEXT NOT NULL,
  "how" TEXT NOT NULL,
  "how_much" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "status" VARCHAR(60) NOT NULL DEFAULT 'aberto',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "grc_planos_acao_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_grc_planos_tenant" ON "grc_planos_acao"("tenant_id");

-- Tesouraria
CREATE TABLE "tesouraria_fornecedores" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "nome" VARCHAR(255) NOT NULL,
  "cnpj" VARCHAR(14) NOT NULL,
  "categoria_fornecedor" VARCHAR(120) NOT NULL,
  "contato" VARCHAR(255) NOT NULL,
  "prazo_pagamento_padrao" INTEGER NOT NULL DEFAULT 30,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "tesouraria_fornecedores_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_tes_fornecedores_tenant" ON "tesouraria_fornecedores"("tenant_id");

CREATE TABLE "tesouraria_despesas" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "fornecedor" VARCHAR(255) NOT NULL,
  "categoria" VARCHAR(120) NOT NULL,
  "descricao" VARCHAR(500) NOT NULL,
  "valor" DECIMAL(14,2) NOT NULL,
  "vencimento" DATE NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'pendente',
  "recorrencia" VARCHAR(30) NOT NULL DEFAULT 'nenhuma',
  "documento_referencia" VARCHAR(255),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "tesouraria_despesas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_tes_despesas_tenant" ON "tesouraria_despesas"("tenant_id");
CREATE INDEX "idx_tes_despesas_vencimento" ON "tesouraria_despesas"("vencimento");

CREATE TABLE "tesouraria_contratos" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "fornecedor_id" TEXT NOT NULL,
  "tipo_contrato" VARCHAR(60) NOT NULL,
  "valor_fixo" DECIMAL(14,2) NOT NULL,
  "vigencia_inicio" DATE NOT NULL,
  "vigencia_fim" DATE NOT NULL,
  "reajuste_anual_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "observacoes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "tesouraria_contratos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tesouraria_contratos_fornecedor_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "tesouraria_fornecedores"("id") ON DELETE RESTRICT
);
CREATE INDEX "idx_tes_contratos_tenant" ON "tesouraria_contratos"("tenant_id");

-- Folha RH
CREATE TABLE "folha_colaboradores_rh" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "nome" VARCHAR(255) NOT NULL,
  "cpf" VARCHAR(11) NOT NULL,
  "cargo" VARCHAR(255) NOT NULL,
  "turno" VARCHAR(30) NOT NULL,
  "salario_base" DECIMAL(14,2) NOT NULL,
  "tipo_contratacao" VARCHAR(30) NOT NULL,
  "data_admissao" DATE NOT NULL,
  "data_demissao" DATE,
  "beneficios_ativos" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "folha_colaboradores_rh_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_folha_colab_tenant" ON "folha_colaboradores_rh"("tenant_id");

CREATE TABLE "folha_beneficios" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "nome_beneficio" VARCHAR(255) NOT NULL,
  "valor_mensal" DECIMAL(14,2) NOT NULL,
  "tipo_beneficio" VARCHAR(60) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "folha_beneficios_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_folha_beneficios_tenant" ON "folha_beneficios"("tenant_id");

CREATE TABLE "folha_presencas" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "colaborador_id" TEXT NOT NULL,
  "data_ref" DATE NOT NULL,
  "horas_trabalhadas" DECIMAL(4,2) NOT NULL DEFAULT 0,
  "horas_extras" DECIMAL(4,2) NOT NULL DEFAULT 0,
  "adicional_noturno_horas" DECIMAL(4,2) NOT NULL DEFAULT 0,
  "falta" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "folha_presencas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "folha_presencas_colab_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "folha_colaboradores_rh"("id") ON DELETE CASCADE
);
CREATE INDEX "idx_folha_presencas_colab" ON "folha_presencas"("colaborador_id");

-- RH Performance
CREATE TABLE "rh_avaliacoes" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "colaborador_id" TEXT NOT NULL,
  "turno_referencia" VARCHAR(30),
  "cargo_referencia" VARCHAR(255),
  "periodo" VARCHAR(20) NOT NULL,
  "avaliador" VARCHAR(255) NOT NULL,
  "nota_tecnica" DECIMAL(4,2) NOT NULL,
  "nota_comportamental" DECIMAL(4,2) NOT NULL,
  "aderencia_procedimentos" DECIMAL(4,2) NOT NULL DEFAULT 0,
  "qualidade_execucao" DECIMAL(4,2) NOT NULL DEFAULT 0,
  "comprometimento" DECIMAL(4,2) NOT NULL DEFAULT 0,
  "comentario_gerencial" TEXT,
  "score_final" DECIMAL(4,2) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "rh_avaliacoes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_rh_avaliacoes_tenant" ON "rh_avaliacoes"("tenant_id");
CREATE INDEX "idx_rh_avaliacoes_colab" ON "rh_avaliacoes"("colaborador_id");

CREATE TABLE "rh_okrs" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "objetivo" TEXT NOT NULL,
  "escopo" VARCHAR(120) NOT NULL,
  "key_results" JSONB NOT NULL DEFAULT '[]',
  "progresso_atual" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "periodo_inicio" DATE NOT NULL,
  "periodo_fim" DATE NOT NULL,
  "responsavel" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "rh_okrs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_rh_okrs_tenant" ON "rh_okrs"("tenant_id");

CREATE TABLE "rh_treinamentos" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "colaborador_id" TEXT NOT NULL,
  "modulo" VARCHAR(255) NOT NULL,
  "carga_horaria" INTEGER NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'pendente',
  "data_conclusao" DATE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "rh_treinamentos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_rh_treinamentos_colab" ON "rh_treinamentos"("colaborador_id");

-- Automação
CREATE TABLE "automacao_workflows" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "nome" VARCHAR(255) NOT NULL,
  "evento_disparo" VARCHAR(255) NOT NULL,
  "condicoes" JSONB NOT NULL DEFAULT '[]',
  "acoes" JSONB NOT NULL DEFAULT '[]',
  "prioridade" INTEGER NOT NULL DEFAULT 3,
  "ativo" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "automacao_workflows_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_auto_workflows_tenant" ON "automacao_workflows"("tenant_id");

CREATE TABLE "automacao_regras" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "nome" VARCHAR(255) NOT NULL,
  "tipo" VARCHAR(120) NOT NULL,
  "expressao_if" TEXT NOT NULL,
  "acao_then" TEXT NOT NULL,
  "acao_else" TEXT,
  "ativo" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "automacao_regras_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_auto_regras_tenant" ON "automacao_regras"("tenant_id");

CREATE TABLE "automacao_execucoes" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "tipo" VARCHAR(30) NOT NULL,
  "evento" VARCHAR(255),
  "workflow_id" TEXT,
  "regra_id" TEXT,
  "rpa_job_id" TEXT,
  "ok" BOOLEAN NOT NULL DEFAULT TRUE,
  "detalhe" TEXT,
  "acoes_resumo" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "automacao_execucoes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_auto_exec_tenant" ON "automacao_execucoes"("tenant_id");
CREATE INDEX "idx_auto_exec_created" ON "automacao_execucoes"("created_at");

CREATE TABLE "automacao_rpa_jobs" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "robot_id" VARCHAR(120) NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'pendente',
  "mensagem" TEXT,
  "tentativa" INTEGER NOT NULL DEFAULT 1,
  "started_at" TIMESTAMPTZ NOT NULL,
  "finished_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "automacao_rpa_jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_auto_rpa_tenant" ON "automacao_rpa_jobs"("tenant_id");

CREATE TABLE "automacao_cron_jobs" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "expressao" VARCHAR(120) NOT NULL,
  "descricao" VARCHAR(500),
  "acao" VARCHAR(255) NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT TRUE,
  "ultima_execucao" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "automacao_cron_jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_auto_cron_tenant" ON "automacao_cron_jobs"("tenant_id");

-- Datahub
CREATE TABLE "datahub_fatos" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "tipo_fato" VARCHAR(60) NOT NULL,
  "sk" VARCHAR(120) NOT NULL,
  "dados" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "datahub_fatos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_dh_fatos_tipo" ON "datahub_fatos"("tipo_fato", "tenant_id");

CREATE TABLE "datahub_dimensoes" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "tipo_dimensao" VARCHAR(60) NOT NULL,
  "sk" VARCHAR(120) NOT NULL,
  "dados" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "datahub_dimensoes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "idx_dh_dim_sk" ON "datahub_dimensoes"("tenant_id", "tipo_dimensao", "sk");

CREATE TABLE "datahub_dw_meta" (
  "tenant_id" VARCHAR(64) NOT NULL,
  "ultima_carga_em" TIMESTAMPTZ,
  CONSTRAINT "datahub_dw_meta_pkey" PRIMARY KEY ("tenant_id")
);

CREATE TABLE "datahub_etl_execucoes" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "fase" VARCHAR(30) NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'SUCESSO',
  "iniciado_em" TIMESTAMPTZ NOT NULL,
  "finalizado_em" TIMESTAMPTZ NOT NULL,
  "duracao_ms" INTEGER NOT NULL DEFAULT 0,
  "linhas_entrada" INTEGER,
  "linhas_saida" INTEGER,
  "mensagem" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "datahub_etl_execucoes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_dh_etl_tenant" ON "datahub_etl_execucoes"("tenant_id");

CREATE TABLE "datahub_lake_arquivos" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "origem" VARCHAR(120) NOT NULL,
  "path_virtual" VARCHAR(512) NOT NULL,
  "payload" JSONB NOT NULL,
  "tamanho_bruto_bytes" INTEGER NOT NULL DEFAULT 0,
  "gzip_simulado_ratio" DECIMAL(5,4) NOT NULL DEFAULT 0.35,
  "bytes_compactados_aprox" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "datahub_lake_arquivos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_dh_lake_tenant" ON "datahub_lake_arquivos"("tenant_id");

-- Plataforma consumo
CREATE TABLE "plataforma_consumo_logs" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64),
  "api_client_id" TEXT NOT NULL,
  "rota" VARCHAR(512) NOT NULL,
  "metodo" VARCHAR(10) NOT NULL,
  "status_http" INTEGER NOT NULL,
  "latency_ms" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "plataforma_consumo_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_plat_consumo_client" ON "plataforma_consumo_logs"("api_client_id");
CREATE INDEX "idx_plat_consumo_created" ON "plataforma_consumo_logs"("created_at");

CREATE TABLE "plataforma_consumo_incidentes" (
  "id" TEXT NOT NULL,
  "tipo" VARCHAR(120) NOT NULL,
  "detalhe" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "plataforma_consumo_incidentes_pkey" PRIMARY KEY ("id")
);

-- Mobile ops
CREATE TABLE "mobile_ops_queue" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "user_id" VARCHAR(64) NOT NULL,
  "canal" VARCHAR(30) NOT NULL,
  "payload" JSONB NOT NULL,
  "payload_digest" VARCHAR(255) NOT NULL,
  "received_at" TIMESTAMPTZ NOT NULL,
  "flushed" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "mobile_ops_queue_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_mobile_ops_user" ON "mobile_ops_queue"("user_id", "flushed");

-- IoT
CREATE TABLE "iot_readings" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "sensor_id" VARCHAR(120) NOT NULL,
  "tipo" VARCHAR(60) NOT NULL,
  "valor" JSONB NOT NULL,
  "timestamp" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "iot_readings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_iot_sensor" ON "iot_readings"("sensor_id", "timestamp");

-- Webhooks
CREATE TABLE "webhook_subscriptions" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "url" TEXT NOT NULL,
  "secret" VARCHAR(255) NOT NULL,
  "eventos" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "webhook_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_webhook_subs_tenant" ON "webhook_subscriptions"("tenant_id");
