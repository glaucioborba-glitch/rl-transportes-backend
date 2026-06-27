-- CreateTable
CREATE TABLE "permissoes_pessoa_autorizada" (
    "id" TEXT NOT NULL,
    "pessoa_id" TEXT NOT NULL,
    "pode_criar_solicitacao" BOOLEAN NOT NULL DEFAULT true,
    "pode_anexar_documentos" BOOLEAN NOT NULL DEFAULT true,
    "pode_agendar_turno" BOOLEAN NOT NULL DEFAULT true,
    "pode_visualizar_financeiro" BOOLEAN NOT NULL DEFAULT false,
    "pode_aprovar_os" BOOLEAN NOT NULL DEFAULT false,
    "pode_ver_os" BOOLEAN NOT NULL DEFAULT true,
    "pode_alterar_dados_gate" BOOLEAN NOT NULL DEFAULT false,
    "pode_gerar_pdf" BOOLEAN NOT NULL DEFAULT true,
    "pode_gerenciar_pessoas" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissoes_pessoa_autorizada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permissoes_pessoa_autorizada_pessoa_id_key" ON "permissoes_pessoa_autorizada"("pessoa_id");

-- CreateIndex
CREATE INDEX "permissoes_pessoa_autorizada_pessoa_id_idx" ON "permissoes_pessoa_autorizada"("pessoa_id");

-- AddForeignKey
ALTER TABLE "permissoes_pessoa_autorizada" ADD CONSTRAINT "permissoes_pessoa_autorizada_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "pessoas_autorizadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
