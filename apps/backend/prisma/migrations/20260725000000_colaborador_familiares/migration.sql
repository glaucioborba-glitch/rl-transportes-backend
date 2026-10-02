CREATE TABLE "colaborador_familiares" (
  "id" TEXT NOT NULL,
  "colaborador_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL DEFAULT 'default',
  "nome" VARCHAR(255) NOT NULL,
  "cpf" VARCHAR(11),
  "data_aniversario" DATE,
  "parentesco" VARCHAR(60),
  "ativo" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "colaborador_familiares_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "colaborador_familiares"
  ADD CONSTRAINT "colaborador_familiares_colaborador_id_fkey"
  FOREIGN KEY ("colaborador_id") REFERENCES "cadastros_colaboradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "idx_colab_familiares_colab" ON "colaborador_familiares"("colaborador_id");
CREATE INDEX "idx_colab_familiares_tenant" ON "colaborador_familiares"("tenant_id");
