-- Placas preferenciais (cavalo / carreta) no cadastro de motorista interno.
ALTER TABLE "cadastros_motoristas"
  ADD COLUMN "placa_cavalo" VARCHAR(10),
  ADD COLUMN "placa_carreta" VARCHAR(10);
