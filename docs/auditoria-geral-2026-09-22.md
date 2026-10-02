# Auditoria geral do sistema — 22/09/2026

> **Atualização de 22/09/2026, 00h40** — parte dos achados já foi corrigida nesta mesma sessão.
> O que foi corrigido está marcado com **✅ CORRIGIDO** no item, e a lista completa está na
> [seção 8](#8-o-que-já-foi-corrigido). Novos achados que apareceram durante a correção estão na
> [seção 9](#9-achados-novos-surgidos-durante-a-correção).

Revisão estática do monorepo (`apps/backend` NestJS, `apps/web` Next.js 14, Prisma/Postgres, Redis, MinIO/S3),
em quatro frentes: segurança e isolamento multi-terminal, correção financeira e fiscal, dívida técnica e
prontidão para operação. Nenhum arquivo foi alterado durante a auditoria.

Os itens marcados **[verificado]** foram conferidos linha a linha no código. Os demais vêm da varredura
automatizada e merecem confirmação antes de virar tarefa.

---

## 1. O retrato do projeto

| Métrica | Valor |
| --- | --- |
| Arquivos TypeScript no backend | 1.354 (1.286 em `src/`) |
| Arquivos TS/TSX no front | 907 |
| Módulos Nest | 126 |
| Modelos Prisma | 100 |
| Migrations | 132 |
| Arquivos de teste unitário | 237 |
| Testes e2e (backend / front) | 35 / 8 |
| Arquivos com mais de 800 linhas | 15 |
| Comentários TODO/FIXME/HACK | 0 |

O projeto é grande e tem infraestrutura séria: CI com Postgres e Redis, verificação de drift de migration,
Dockerfiles, compose de produção, scripts de backup e restore, health checks, validação de variáveis no boot,
circuit breaker e trilha de auditoria. O problema não é ausência de fundação — é que partes críticas do
dinheiro e do isolamento entre terminais têm lacunas que só aparecem com mais de um cliente em produção.

---

## 2. Bloqueadores antes de vender para o segundo terminal

Estes são os itens que eu resolveria antes de colocar um segundo cliente no mesmo servidor.

### 2.1 O filtro automático por terminal cobre um quarto dos modelos **[verificado]**

`apps/backend/src/tenant/tenant.constants.ts:2-26` lista **25 modelos** em `TENANT_SCOPED_MODELS`, e é essa
lista que a extensão do Prisma (`apps/backend/src/prisma/prisma.service.ts:40-44`) usa para injetar
`where tenantId`. O schema tem cerca de **90 modelos com coluna `tenantId`**. Tudo que está fora da lista
depende do programador lembrar de filtrar na mão.

Consequências já localizadas:

- `apps/backend/src/cadastros/cadastros-tabelas-precos.service.ts:46-48` — lista tabelas de preço com
  `where: { deletedAt: null }`, sem terminal. Tabela comercial de um cliente visível para outro.
- `apps/backend/src/unidade-processo/unidade-processo.service.ts:81-88` — `findAbertoPorIso` busca por ISO e
  status sem terminal. Dois terminais com o mesmo contêiner colidem no gate e no pátio.
- `apps/backend/prisma/schema.prisma:1513-1544` — `PreFatura` não tem `tenantId`; o isolamento depende de
  join com `Cliente`.

**Correção:** completar a lista, e criar um teste e2e de isolamento que autentica no terminal A e tenta ler
dados do B em cada rota de listagem. Sem esse teste, a lista volta a ficar defasada.

### 2.2 SQL cru não passa pelo filtro

`apps/backend/src/dashboard/dashboard.service.ts:160-195` (e equivalentes em `dashboard-performance.service.ts`
e `bi-analytics.service.ts`) agregam gate, faturamento e solicitações em `$queryRaw` sem `WHERE tenant_id`.
A extensão do Prisma não alcança SQL cru, então dashboards e BI misturam números de todos os terminais.

**Correção:** parametrizar o terminal em todo `$queryRaw` ou usar views já segmentadas.

### 2.3 Contexto de terminal é resolvido depois dos guards

`apps/backend/src/auth/strategies/jwt.strategy.ts:62-64` consulta o usuário antes do `TenantInterceptor`
rodar, então a extensão usa `default`. Hoje funciona porque o id do usuário é UUID global, mas é sorte
estrutural: qualquer consulta por chave composta (CPF + terminal) passa a falhar ou acertar o registro errado.
Mesmo padrão em `cx-portal-auth.guard.ts:59` e `pdf-solicitacao-v2-access.guard.ts:66`.

**Correção:** resolver o terminal em middleware, antes da cadeia de guards.

### 2.4 Biometria de motorista em texto claro

`apps/backend/prisma/schema.prisma:2073-2088` guarda o template `firText` sem criptografia, e
`apps/backend/src/motorista-biometria/motorista-biometria.service.ts:17-27` devolve o template completo no
`GET :cpf`. Dado biométrico é dado sensível na LGPD: um dump de banco entrega templates reutilizáveis.

**Correção:** criptografar em repouso, nunca devolver o template pela API (só `enrolled: true/false`) e
definir retenção.

---

## 3. Dinheiro e fiscal

### 3.1 Uma nota autorizada libera faturas que não são dela **[verificado]**

`apps/backend/src/fiscal-integracao/nfse-polling.cron.ts:51-64`: ao confirmar **uma** NFS-e, o cron busca
**todas** as faturas com o mesmo `faturamentoId` em `PROCESSANDO`, grava nelas o `linkNfse` dessa nota e
promove para `AGUARDANDO_PAGAMENTO` as que já tenham boleto. Com vários gate-outs do mesmo cliente no mês,
faturas cuja nota ainda não saiu passam a ser cobradas com o link de outra nota.

**Correção:** ligar `NfsEmitida` à `Fatura` por chave estrangeira e atualizar só a fatura da nota confirmada.

### 3.2 Emissão externa acontece fora da transação

`apps/backend/src/outbox/nfse-boleto-outbox.processor.ts:131-163` chama prefeitura e banco **antes** do
`$transaction` que grava `nfsEmitida`, `boleto` e atualiza a fatura (`:181-276`). Se a transação falhar depois
de a nota já ter sido emitida, o retry emite de novo: segunda NFS-e e segundo boleto para a mesma fatura.

A idempotência atual (`:53-63`) depende de um registro em `auditoria` gravado **só no sucesso**, e o
early-return só cobre o status `AGUARDANDO_PAGAMENTO`. Não checa se já existe `faturamentoId`, nota ou boleto.

Agrava: `apps/backend/src/outbox/outbox.service.ts:59-65` devolve eventos travados para `PENDING` usando
`createdAt` em vez do instante do claim — uma emissão que demore mais de 5 minutos pode ser reprocessada
**em paralelo**.

**Correção:** gravar marca idempotente antes da chamada externa, reconciliar pelo que já existe no banco, e
usar `claimedAt` no reclaim.

### 3.3 Duas contagens de diária diferentes

`apps/backend/src/armazenagem-faturamento/armazenagem-billing.util.ts:15-30` soma milissegundos e adiciona um
dia se sobrar qualquer fração de hora; `apps/backend/src/billing-engine/billing-rule-engine.util.ts:63-65`
conta a partir da meia-noite UTC. Permanências curtas ou na virada do dia geram uma diária de diferença entre
a simulação do portal, a provisão e a fatura final — exatamente o tipo de divergência que o cliente reclama.

**Correção:** uma função única, com a regra escrita (cheia ou proporcional) e usada em todo o caminho.

### 3.4 Valores que viram cobrança sem cadastro

- `apps/backend/src/billing-engine/billing-rule-engine.util.ts:423-424` — reefer sem regra cadastrada é
  cobrado a **R$ 45/dia** por um default no código.
- `apps/backend/src/billing-engine/faixa-diaria-calculator.ts:18-22` — dia que não cai em nenhuma faixa é
  cobrado como **zero**, silenciosamente. Tabela com buraco entre faixas reduz receita sem aviso.

**Correção:** falhar o fechamento e alertar, como já é feito quando falta tabela de preço. Preço nunca deve
vir de constante no código.

### 3.5 Conta corrente

- **Crédito do PIX é manual, por decisão de produto.** `conta-corrente.service.ts:186-233` aprova o
  comprovante, notifica o cliente e não lança crédito — isso é intencional. O risco real é outro: nada amarra
  o comprovante aprovado ao lançamento que o financeiro faz depois, então dá para creditar duas vezes e não
  existe relatório de "aprovado sem crédito lançado". **[verificado]**
- `conta-corrente.service.ts:347-381` — lançamento manual de débito não verifica saldo; só o caminho de
  quitação na saída (`:269-277`) bloqueia.
- `conta-corrente.service.ts:318-345` — `compensar()` lê o saldo e grava em chamadas separadas, sem transação
  nem lock. Dois operadores em paralelo podem compensar o mesmo saldo duas vezes.

### 3.6 Numeração de RPS por relógio

`apps/backend/src/fiscal-integracao/fiscal-ipm.service.ts:106` usa `Date.now()` cortado em 9 dígitos. Não é
sequência por terminal e série, pode colidir em rajada e é difícil de auditar. O mesmo padrão ficou na DPS do
Emissor Nacional que implementamos hoje — está documentado lá, mas vale a mesma correção: sequência atômica no
Postgres com unicidade por série.

### 3.7 Régua de cobrança

`apps/backend/src/dunning/dunning-process.service.ts:24-28` inclui faturas em `PROCESSANDO` na varredura, e
`:156-163` envia e-mail sem deduplicação (o WhatsApp tem). Resultado possível: cobrar cliente por fatura que
ainda não tem nota nem boleto, e cobrar duas vezes se o cron sobrepor.

---

## 4. Dívida técnica

Os números por si já dizem onde está o risco: os serviços mais importantes são os maiores e os menos testados.

| Arquivo | Linhas | Teste unitário |
| --- | --- | --- |
| `apps/web/lib/api/portal-client.ts` | 2.060 | — |
| `apps/backend/src/gate-v2/gate-operacao-flow.service.ts` | 1.786 | **nenhum** |
| `apps/backend/src/modules/solicitacoes-v2/solicitacoes-v2.service.ts` | 1.346 | mínimo |
| `apps/backend/src/armazenagem-faturamento/armazenagem-billing.service.ts` | 1.220 | parcial |
| `apps/backend/src/cx-portais/services/portal-cliente-data.service.ts` | 1.196 | **nenhum** |

Outros pontos:

- **Cadastros**: 24 de 25 serviços sem teste. É o MDM que alimenta preço e faturamento.
- **Audit trail** (`audit-trail.service.ts`): nenhum teste, e é o que responde por compliance.
- **Cobertura**: configurada, mas com limiar baixo (39% de branches) e excluindo controllers; o CI não roda
  `test:cov`.
- **`tsc --noEmit` acusa 9 erros**, todos em arquivos de teste (`mobile-sync.service.spec.ts`,
  `test/helpers/e2e-pricing.factory.ts`). O lint do CI usa outro tsconfig e não pega.
- **Fallbacks em memória**: Redis (`redis.service.ts:22`), telemetria
  (`observabilidade-telemetry.store.ts:31`) e rate limit do portal
  (`cx-portal-security.service.ts:6`) degradam para `Map` local. Em uma instância só funciona; em duas, o
  rate limit deixa de valer.
- **Dois caminhos para a mesma coisa**: `solicitacoes` e `solicitacoes-v2` convivem; no front há
  `operacao-api.ts` além do cliente padrão, e cerca de 40 `fetch` soltos.
- **Sem husky/pre-commit**: tudo aparece só no CI.

---

## 5. Operação e produção

### 5.1 O que assusta no dia da demonstração

- **Perfil de módulos**: `apps/backend/src/modules/phase-imports.ts:12` usa `full` como padrão. Sem
  `FEATURE_PHASES=operational` explícito, a máquina modesta carrega Enterprise, Analytics, Datahub e Chaos, e
  ainda passa a refazer views materializadas a cada 15 minutos. **[verificado]**
- **Health do Redis mente**: `redis.service.ts:342-344` responde `PONG` também no modo de memória, e
  `health/indicators/redis.health.ts:18-23` aceita isso como saudável. O sistema parece íntegro com o Redis
  fora. **[verificado]**
- **PDF no container**: `infra/dockerfiles/Dockerfile.backend:29-31` não instala Chromium, e
  `pdf-operacional-v2.service.ts:71-83` procura caminhos locais. Emissão de PDF quebra no container.
- **Ordem do deploy**: `infra/scripts/deploy.sh:28-43` reinicia a aplicação **antes** de `migrate deploy` —
  há uma janela com código novo e banco velho.
- **132 migrations**: aplicar na hora da reunião é risco desnecessário.
- **Seeds de QA**: `prisma/seed.ts:39-47` e `scripts/seed-all.ts:33-77` criam credenciais conhecidas e um
  arquivo `dados-teste-seed-all.txt`. Na demo, só `seed-prod`.

### 5.2 Consultas que pesam

- `armazenagem-billing.service.ts:417-493` — provisão diária em laço, com várias consultas por item (N+1).
- `patio-v2/patio.service.ts:699-767` — inventário carrega todas as posições e unidades, com includes
  profundos e sem limite.
- `dashboard-financeiro.service.ts:143-151` — traz todos os faturamentos do filtro e agrega em memória.

### 5.3 Configuração

Existe validação no boot (`config/env-boot.validation.ts:25-58`), mas o `.env.example` da raiz não cobre tudo
que o código lê: `REDIS_URL`, `FRONTEND_ORIGIN`, `STORAGE_SIGNING_SECRET`, `INTEGRACAO_*`, `PUBLIC_API_URL`,
`RESILIENCE_ENABLED`, `PDF_USE_LAMBDA_CHROMIUM`, entre outros. O template completo é
`infra/.env.production.example`; quem copiar o da raiz sobe sem variável obrigatória. No front falta
`INTERNAL_API_URL`, que `lib/server-api-base.ts:3` usa.

Outros pontos: `/health` público inclui a prefeitura (`health.controller.ts:47-51`), então o load balancer
passa a depender do IPM; logs Winston escrevem em arquivo sem rotação
(`common/logger/winston.config.ts:33-41`); e o `fetch` de feriados
(`tenant/tenant-config.service.ts:377`) é o único sem timeout.

---

## 6. O que eu faria, em ordem

**Antes da demonstração** (baixo esforço, evita vergonha na reunião)

1. `FEATURE_PHASES=operational`, `CHAOS_ENGINE_ENABLED=0`, `REDIS_OPTIONAL=0` no `.env.production`.
2. Migrations e `seed:prod` aplicados com antecedência; remover artefatos de QA.
3. Resolver o PDF (Chromium na imagem) ou não demonstrar o fluxo que gera PDF.
4. Corrigir o health do Redis para não dar falso positivo.
5. Ensaio completo: login, um gate-in/out, portal do cliente e mapa do pátio com duas ou três sessões.

**Primeira semana depois** (dinheiro e confiança)

6. Corrigir o polling de NFS-e (item 3.1) — é o que pode cobrar cliente com nota de outro.
7. Tornar o outbox idempotente de verdade e trocar o reclaim por `claimedAt` (3.2).
8. Unificar a contagem de diárias e remover os defaults de preço do código (3.3, 3.4).
9. Amarrar comprovante PIX aprovado ao lançamento, com relatório de pendentes (3.5).

**Antes do segundo terminal** (isolamento)

10. Completar `TENANT_SCOPED_MODELS`, filtrar o SQL cru e criar o e2e de isolamento (2.1, 2.2).
11. Resolver o terminal antes dos guards (2.3).
12. Criptografar a biometria e parar de devolvê-la pela API (2.4).
13. Restringir `maps-config` a ADMIN/GERENTE e desligar o Chaos fora de desenvolvimento.

**Contínuo**

14. Testes para `gate-operacao-flow`, `portal-cliente-data` e `audit-trail`; consertar os 9 erros de `tsc`
    nos specs e rodar cobertura no CI.
15. Quebrar `portal-client.ts` e os componentes de gate; unificar os clientes HTTP do front.

---

## 8. O que já foi corrigido

Tudo abaixo foi implementado e está coberto por teste onde havia lógica testável. A suíte das áreas
tocadas passa (116 testes) e o backend sobe com `/health` respondendo apenas banco e Redis.

### Demonstração

| Achado | Correção | Arquivo |
| --- | --- | --- |
| Health do Redis dava falso positivo em modo memória | `isMemoryFallback()` passou a reprovar o health; em produção derruba o check, fora dela sinaliza `modo: memoria` | `src/health/indicators/redis.health.ts`, `src/health/health.controller.ts` |
| `FEATURE_PHASES` padrão `full` carregava BI/Enterprise na máquina modesta | Padrão passou a depender do ambiente: `operational` em produção, `full` em desenvolvimento | `src/modules/phase-imports.ts` |
| `/health` público dependia da prefeitura | IPM saiu do check público e virou campo `fiscalIpm` no `/health/diagnostic` (autenticado) | `src/health/health.controller.ts`, `src/health/health-response.types.ts` |
| `fetch` de feriados sem timeout | `AbortSignal.timeout(8_000)` | `src/tenant/tenant-config.service.ts` |

### Dinheiro e fiscal

| Achado | Correção | Arquivo |
| --- | --- | --- |
| Uma NFS-e autorizada liberava todas as faturas do mês | O polling agora casa a nota com a fatura pelo RPS (`numeroRps`/`serieRps`) e registra aviso se não achar par | `src/fiscal-integracao/nfse-polling.cron.ts` |
| Retry do outbox podia emitir nota e boleto em dobro | Reconciliação antes de emitir: se já existe NFS-e (pelo RPS) ou boleto para a fatura, o evento fecha o estado sem chamar prefeitura nem banco | `src/outbox/nfse-boleto-outbox.processor.ts` |
| Reclaim usava `createdAt` e podia processar em paralelo | Novo campo `claimed_at`, gravado no claim e usado no reclaim (migration `20260922030000_outbox_claimed_at`, já aplicada) | `prisma/schema.prisma`, `src/outbox/outbox.service.ts` |
| Energia reefer cobrada a R$ 45/dia por default no código | Sem tarifa nem faixa cadastrada, o fechamento falha com mensagem pedindo o cadastro | `src/billing-engine/billing-rule-engine.util.ts` |
| Dia fora das faixas era cobrado como zero | Nova função `diasSemFaixa` e trava no fechamento quando as faixas não cobrem a permanência | `src/billing-engine/faixa-diaria-calculator.ts`, `billing-rule-engine.util.ts` |

### Segurança

| Achado | Correção | Arquivo |
| --- | --- | --- |
| Template biométrico em texto claro no banco | AES-256-GCM em repouso, com `BIOMETRIA_ENCRYPTION_KEY` (deriva de `JWT_SECRET` se ausente) e leitura compatível com registros antigos | `src/motorista-biometria/biometria-crypto.util.ts`, `motorista-biometria.service.ts` |
| Tabela de preço listada sem filtro de terminal | `CadastroTabelaPreco` entrou no filtro automático do Prisma | `src/tenant/tenant.constants.ts` |
| Processo de unidade encontrado só pelo ISO | `UnidadeProcesso` entrou no filtro automático do Prisma | `src/tenant/tenant.constants.ts` |
| Chaos Monkey acessível a ADMIN em produção | Em produção, só `SUPER_ADMIN` | `src/chaos/chaos.controller.ts` |

Testes novos: `biometria-crypto.util.spec.ts` (5 casos) e trava de energia reefer em
`billing-rule-engine.util.spec.ts`. O fixture de teste do motor de preço passou a incluir a regra de
energia — ele dependia justamente do valor escondido no código.

---

## 9. Achados novos, surgidos durante a correção

1. **O teste do motor de preço validava o default escondido.** `billing-rule-engine.util.spec.ts`
   passava porque a tabela de teste não tinha regra de energia e o código completava com R$ 45. Sempre
   que um default silencioso existe, é provável que algum teste o esteja abençoando.

2. **A chave do Google Maps não pôde ser restringida** e **continua aberta a qualquer staff**
   (`src/tenant/tenant-config.controller.ts`). Tentei limitar a ADMIN/GERENTE, mas a tela
   `operador/(workspace)/localizacao-motoristas` é do operador e o mapa deixaria de carregar. A correção
   certa é servir o mapa por proxy no backend, ou manter a chave restrita por referrer/IP no Google Cloud.
   **Não corrigido de propósito** — registrado aqui para não quebrar a demonstração.

3. **`NfsEmitida` e `Fatura` se ligam apenas pelo RPS.** A correção do polling usa
   `numeroRps`/`serieRps` porque não existe chave estrangeira entre as duas tabelas. Funciona, mas o certo
   é uma FK: enquanto o RPS for gerado por `Date.now()` (item 3.6), a amarração depende de um número que
   pode colidir.

4. **`UnifiedHealthResponse` era um tipo fechado sem o IPM**, o que fez o teste do health quebrar na
   primeira tentativa. Sinal de que o contrato do `/health/diagnostic` não tinha espaço para novas
   dependências — agora tem.

5. **A reconciliação do outbox depende de `Boleto.faturamentoId`**, não de `faturaId`. Com o modelo
   mensal (`Faturamento` agregando vários gate-outs), contar boletos por faturamento é aproximação: se o
   cliente tem dois gate-outs no mês, a contagem enxerga boleto do outro. A trava evita emissão em dobro,
   mas pode reconciliar antes da hora — reforça o item 3.4 do relatório (modelo mensal versus gate-out).

6. **O filtro automático de terminal cresceu para 27 modelos**, de cerca de 90 com o campo. Adicionei
   só os dois que tinham vazamento comprovado, porque cada modelo incluído muda todas as consultas dele.
   Expandir o resto exige o teste e2e de isolamento primeiro — senão a correção vira risco.

---

## 10. Observações de método

- Contagens excluem `node_modules`, `dist` e `.next`.
- "90 modelos com `tenantId`" vem da contagem de linhas de campo no schema; alguns modelos declaram o campo
  mais de uma vez, então o número exato de modelos afetados pode ser um pouco menor. A ordem de grandeza
  (um quarto coberto) está correta.
- O crédito manual do PIX foi confirmado como decisão de produto nesta sessão, não como defeito.
- As seções 2 a 6 descrevem o estado **antes** das correções; a seção 8 diz o que mudou desde então.
- O que continua em aberto, por ordem de risco: expandir o filtro de terminal com teste de isolamento,
  filtrar o SQL cru dos dashboards, resolver o terminal antes dos guards, amarrar comprovante PIX ao
  lançamento, unificar a contagem de diárias, sequência real de RPS e proxy para a chave do Maps.
