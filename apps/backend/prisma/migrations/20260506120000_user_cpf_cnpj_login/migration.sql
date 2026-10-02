-- AlterTable
ALTER TABLE "users" ADD COLUMN "cpf_cnpj" VARCHAR(14);

-- Opcional: alinha documento fiscal QA legado antes do vínculo users↔clientes
UPDATE "clientes"
SET "cpfCnpj" = '19131243000197'
WHERE "email" = 'empresa.portal.qa@rl.local.test';

-- Vincula usuário ao mesmo CPF/CNPJ do cadastro cliente
UPDATE "users" AS u
SET "cpf_cnpj" = c."cpfCnpj"
FROM "clientes" AS c
WHERE u."clienteId" = c."id"
  AND u."cpf_cnpj" IS NULL;

-- Contas staff / QA por e-mail (CNPJs válidos distintos)
UPDATE "users" SET "cpf_cnpj" = '04252011000110' WHERE "email" = 'admin@rltransportes.com' AND "cpf_cnpj" IS NULL;
UPDATE "users" SET "cpf_cnpj" = '11000000000108' WHERE "email" = 'gerente.ops.qa@rl.local.test' AND "cpf_cnpj" IS NULL;
UPDATE "users" SET "cpf_cnpj" = '19131243000197' WHERE "email" = 'cliente.portal.qa@rl.local.test' AND "cpf_cnpj" IS NULL;
UPDATE "users" SET "cpf_cnpj" = '11000000000299' WHERE "email" = 'operador.portaria.qa@rl.local.test' AND "cpf_cnpj" IS NULL;
UPDATE "users" SET "cpf_cnpj" = '11000000000370' WHERE "email" = 'operador.supervisor.qa@rl.local.test' AND "cpf_cnpj" IS NULL;

-- Demais usuários: um CNPJ válido único por linha (pool de 60)
WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY "email") AS rn
  FROM "users"
  WHERE "cpf_cnpj" IS NULL
),
pool AS (
  SELECT * FROM (VALUES
    (1, '11000000000450'),
    (2, '11000000000531'),
    (3, '11000000000612'),
    (4, '11000000000701'),
    (5, '11000000000884'),
    (6, '11000000000965'),
    (7, '11000000001007'),
    (8, '11000000001180'),
    (9, '11000000001260'),
    (10, '11000000001341'),
    (11, '11000000001422'),
    (12, '11000000001503'),
    (13, '11000000001694'),
    (14, '11000000001775'),
    (15, '11000000001856'),
    (16, '11000000001937'),
    (17, '11000000002070'),
    (18, '11000000002151'),
    (19, '11000000002232'),
    (20, '11000000002313'),
    (21, '11000000002402'),
    (22, '11000000002585'),
    (23, '11000000002666'),
    (24, '11000000002747'),
    (25, '11000000002828'),
    (26, '11000000002909'),
    (27, '11000000003042'),
    (28, '11000000003123'),
    (29, '11000000003204'),
    (30, '11000000003395'),
    (31, '11000000003476'),
    (32, '11000000003557'),
    (33, '11000000003638'),
    (34, '11000000003719'),
    (35, '11000000003808'),
    (36, '11000000003980'),
    (37, '11000000004014'),
    (38, '11000000004103'),
    (39, '11000000004286'),
    (40, '11000000004367'),
    (41, '11000000004448'),
    (42, '11000000004529'),
    (43, '11000000004600'),
    (44, '11000000004790'),
    (45, '11000000004871'),
    (46, '11000000004952'),
    (47, '11000000005096'),
    (48, '11000000005177'),
    (49, '11000000005258'),
    (50, '11000000005339'),
    (51, '11000000005410'),
    (52, '11000000005509'),
    (53, '11000000005681'),
    (54, '11000000005762'),
    (55, '11000000005843'),
    (56, '11000000005924'),
    (57, '11000000006068'),
    (58, '11000000006149'),
    (59, '11000000006220'),
    (60, '11000000006300')
  ) AS t(idx, doc)
)
UPDATE "users" AS u
SET "cpf_cnpj" = p.doc
FROM ranked AS r
JOIN pool AS p ON p.idx = r.rn
WHERE u.id = r.id
  AND r.rn <= 60;

ALTER TABLE "users" ALTER COLUMN "cpf_cnpj" SET NOT NULL;

CREATE UNIQUE INDEX "users_cpf_cnpj_key" ON "users"("cpf_cnpj");
