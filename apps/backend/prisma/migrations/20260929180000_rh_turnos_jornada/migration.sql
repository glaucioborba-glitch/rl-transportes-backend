CREATE TABLE "rh_turnos_jornada" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "codigo" VARCHAR(32) NOT NULL,
  "nome" VARCHAR(120) NOT NULL,
  "hora_inicio" VARCHAR(8) NOT NULL,
  "hora_fim" VARCHAR(8) NOT NULL,
  "dias_semana" JSONB NOT NULL DEFAULT '[]',
  "jornada_semanal_horas" INTEGER,
  "regime_sabado" VARCHAR(32) NOT NULL DEFAULT 'SEM_SABADO',
  "sabado_hora_inicio" VARCHAR(8),
  "sabado_hora_fim" VARCHAR(8),
  "sabado_referencia" DATE,
  "observacoes" VARCHAR(500),
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "rh_turnos_jornada_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rh_turnos_jornada_tenant_id_codigo_key" ON "rh_turnos_jornada"("tenant_id", "codigo");
CREATE INDEX "rh_turnos_jornada_tenant_id_ativo_idx" ON "rh_turnos_jornada"("tenant_id", "ativo");

ALTER TABLE "rh_turnos_jornada"
  ADD CONSTRAINT "rh_turnos_jornada_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
