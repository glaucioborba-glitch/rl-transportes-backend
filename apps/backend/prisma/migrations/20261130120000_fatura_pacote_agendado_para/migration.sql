ALTER TABLE "faturas_pacote" ADD COLUMN "agendado_para" TIMESTAMP(3);

CREATE INDEX "faturas_pacote_status_agendado_para_idx" ON "faturas_pacote"("status", "agendado_para");
