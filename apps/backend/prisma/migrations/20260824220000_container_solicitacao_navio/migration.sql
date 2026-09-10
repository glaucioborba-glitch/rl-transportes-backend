-- Nome do navio informado pelo cliente na solicitação (opcional).

ALTER TABLE "containers_solicitacao" ADD COLUMN "navio" VARCHAR(120) NOT NULL DEFAULT '';
