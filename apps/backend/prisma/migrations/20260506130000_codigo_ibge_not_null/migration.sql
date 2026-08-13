-- Garantir codigo_municipio_ibge NOT NULL (cadastros legados: placeholder até correção manual).
UPDATE clientes SET codigo_municipio_ibge = '0000000' WHERE codigo_municipio_ibge IS NULL;
ALTER TABLE "clientes" ALTER COLUMN "codigo_municipio_ibge" SET NOT NULL;
