ALTER TABLE "portarias" ADD COLUMN "cadastro_transportadora_id" VARCHAR(36);

CREATE INDEX "portarias_cadastro_transportadora_id_idx" ON "portarias"("cadastro_transportadora_id");

ALTER TABLE "portarias"
  ADD CONSTRAINT "portarias_cadastro_transportadora_id_fkey"
  FOREIGN KEY ("cadastro_transportadora_id")
  REFERENCES "cadastros_transportadoras"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
