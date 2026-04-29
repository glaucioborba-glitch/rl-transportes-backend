# Blueprint Global da Plataforma RL Transportes

**Classificação:** Confidencial — Uso interno e compartilhamento controlado com parceiros sob NDA  
**Versão:** 1.0  
**Última atualização:** abril de 2026  
**Escopo:** Documentação executiva e técnica unificada (exportável para PDF/A4)

---

## Sumário

1. [Visão geral da plataforma](#1-visão-geral-da-plataforma)
2. [Arquitetura técnica](#2-arquitetura-técnica)
3. [Domínio de negócios](#3-domínio-de-negócios-logística-portuária--terminal-de-contêiner)
4. [Módulos do sistema](#4-módulos-do-sistema-organograma-de-software)
5. [Modelo de dados (visão Prisma)](#5-modelo-de-dados-visão-prisma)
6. [Fluxos operacionais (E2E)](#6-fluxos-operacionais-e2e)
7. [Segurança e compliance](#7-segurança-e-compliance)
8. [Observabilidade e SRE](#8-observabilidade-e-sre)
9. [Ambientes e DevOps](#9-ambientes-e-devops)
10. [Roadmap evolutivo](#10-roadmap-evolutivo)
11. [Anexos](#11-anexos)

---

## 1. Visão geral da plataforma

### 1.1 Objetivo estratégico

A plataforma RL Transportes consolida a **gestão digital de terminal de apoio logístico com foco em armazenagem de contêineres**, integrando operação de campo, portal do cliente, faturamento fiscal, governança e camadas avançadas de inteligência, automação e observabilidade. O objetivo estratégico é **reduzir fricção operacional, aumentar rastreabilidade, acelerar ciclo de faturamento e habilitar decisões baseadas em dados**, com arquitetura preparada para escala multi-módulo e integrações B2B.

### 1.2 Missão operacional

Digitalizar e orquestrar o ciclo **Solicitação → Portaria → Gate → Pátio → Saída → Faturamento → NFS-e / Boletos**, com **auditoria contínua**, **controle de acesso granular** e **experiências diferenciadas** para operador, cliente, motorista e gestão.

### 1.3 Proposta de valor

| Público | Valor entregue |
|--------|----------------|
| **Interno / operação** | Fluxo único da solicitação, indicadores em tempo real, cockpit e mobile hub, redução de retrabalho e erros de papel. |
| **Cliente (B2B)** | Portal com visibilidade de solicitações, SLAs, documentos e financeiro autorizado; aprovações com trilha auditável. |
| **Operador / motorista** | Interfaces focadas (portaria, gate, pátio; app motorista) com validações (ISO 6346, placas Mercosul) e integração com backend corporativo. |
| **Diretoria / financeiro** | Dashboards executivos, conciliação, pricing comercial, simulador de capacidade e linha de evolução para autonomia (AI-Console, Robotic Ops). |

### 1.4 Arquitetura geral (diagrama textual)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CAMADA DE EXPERIÊNCIA                              │
│  Next.js 14 (App Router) — Operador, Portal Cliente, Motorista, Admin,      │
│  BI, GRC, SSMA, Digital Twin, AI-Console, Cockpit, AGI/AOG (evolutivo)      │
└──────────────────────────────────────┬────────────────────────────────────┘
                                       │ HTTPS / JSON / cookies opcionais
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      API CORPORATIVA — NestJS 11                             │
│  Auth (JWT + Refresh + cookies HttpOnly opcional) · RBAC/PBAC · CSRF *    │
│  Domínio: clientes, solicitações, faturamento, NFSe, portal, dashboards…    │
│  Integração: cliente-api, webhooks, mobile hub, API pública (Fase 18)       │
└──────────────────────────────────────┬────────────────────────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
            ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
            │  PostgreSQL  │  │    Redis     │  │  Provedores  │
            │   (Prisma)   │  │ cache/rate   │  │ NFSe / IPM…  │
            └──────────────┘  └──────────────┘  └──────────────┘

* CSRF double-submit ativado por ambiente (`CSRF_ENABLED=1`).
```

**Referências de código (monorepo):**

- Frontend: `apps/web/`
- Backend: `apps/backend/`
- Contrato de dados: `apps/backend/prisma/schema.prisma`
- Pilha HTTP / CORS / CSRF: `apps/backend/src/http/http-stack.ts`, `apps/backend/src/config/security.config.ts`

---

## 2. Arquitetura técnica

### 2.1 Backend (NestJS)

| Componente | Uso na RL Transportes |
|-----------|------------------------|
| **NestJS** | Orquestração modular (controllers, services, guards, pipes, interceptors). |
| **Prisma ORM** | Acesso tipado ao PostgreSQL; migrações versionadas em `prisma/migrations/`. |
| **PostgreSQL** | Sistema de registro único para entidades persistentes do domínio principal. |
| **Redis** | Suporte a cache global, rate limit de login e padrões de resiliência. |
| **JWT** | Access token corporativo; payload inclui `sub`, `role`, `tv` (tokenVersion), `clienteId` quando aplicável. |
| **Refresh token** | Assinado com **`JWT_REFRESH_SECRET`** distinto do access; rotação compatível com cookies HttpOnly. |
| **RBAC** | Papéis `Role` no Prisma (`ADMIN`, `GERENTE`, `OPERADOR_*`, `CLIENTE`). |
| **PBAC** | Permissões string (`solicitacoes:gate`, `nfse:emitir`, …) em `role-permissions.ts`; extensões por e-mail (ex.: TI/Dados no Datahub). |
| **Auditoria** | Registros em `auditorias` com `AcaoAuditoria` (INSERT, UPDATE, DELETE, READ, SEGURANCA). |

### 2.2 Frontend (Next.js 14)

- **App Router**, componentes React 18, **Tailwind CSS**, **Zustand** para estado de autenticação (portal, staff, motorista).
- Clientes HTTP com refresh silencioso onde aplicável (`lib/api/portal-client.ts`, `staff-client.ts`, `motorista-client.ts`).
- Headers de segurança e **CSP** em `apps/web/next.config.mjs`.
- Modo opcional de cookies HttpOnly alinhado ao backend (`NEXT_PUBLIC_AUTH_HTTP_ONLY`).

### 2.3 Digital Twin Architecture (2D / 3D)

- **Posicionamento:** área `digital-twin` no frontend (visualização 3D com Three.js / React Three Fiber onde implementado).
- **Papel:** suporte a cenários visuais de pátio, capacidade e “what-if”, integrado conceitualmente ao **Simulador Terminal** e aos dashboards operacionais.
- **Integração:** consome as mesmas APIs de performance e operação; não substitui o registro transacional do Prisma.

### 2.4 AI-Console Architecture

- **Conceito:** console segmentado (**Operacional / Financeiro / Estratégico**) para assistência à decisão, síntese de indicadores e acionamento de fluxos de exceção documentados.
- **Implementação evolutiva:** combinação de módulos **IA operacional**, **IA preditiva** (estatística local), e endpoints de dados agregados — **sem dependência obrigatória de LLM externo** nas camadas estatísticas existentes.

### 2.5 Robotic Ops (automações inteligentes)

- **Módulo:** `automacao-processos` — engine de workflows, RPA simulado, rule engine, scheduler e dashboard de automação.
- **Função:** orquestrar ações **if/then**, jobs assíncronos e integração futura com eventos corporativos (barramento interno / webhooks), sob RBAC rigoroso.

### 2.6 AOG (Autonomous Operations Governance)

- **Conceito:** camada de **governança autônoma** — políticas, limites, aprovações e trilhas de auditoria para automações que possam alterar estado operacional ou financeiro.
- **Realização:** combinação de **GRC/Compliance**, **auditoria**, **papéis supervisores** (env / listas de e-mail) e regras nos módulos de automação.

### 2.7 AGI-Ops (autonomia nível 5 — visão alvo)

- **Definição-alvo:** sistema capaz de **detectar desvios**, **propor ou executar** correções dentro de políticas aprovadas, **explicar decisões** e **reverter** via trilha de auditoria, com human-in-the-loop configurável.
- **Estado atual:** fundações em dados, automação, IA preditiva local e observabilidade; **nível 5 como roadmap**, não como compromisso de produto imediato.

### 2.8 Observabilidade (Winston + Prometheus + Grafana)

- **Logging:** Winston configurado globalmente (`nest-winston`).
- **Métricas:** construção de texto Prometheus no módulo de observabilidade (`observabilidade-prometheus.builder`); exposição alinhada às rotas de observabilidade do backend.
- **Grafana:** painéis operacionais recomendados como **camada externa** (provisionamento JSON exportável em evolução — ver roadmap).

### 2.9 Estratégia de deploy

- **Desenvolvimento:** Docker Compose para PostgreSQL (e serviços auxiliares); `npm run dev:backend` / `dev:web`.
- **CI/CD:** pipeline GitHub Actions (`.github/workflows/ci.yml`) — validação Prisma, migrações em banco de teste, build, testes unitários e E2E, lint frontend, auditoria de dependências, artefato opcional de consolidação de código.
- **Produção:** variáveis de ambiente por estágio; **CORS** e **cookies Secure/SameSite** explícitos; Swagger desligado por padrão em produção salvo flag.

---

## 3. Domínio de negócios (logística portuária / terminal de contêiner)

### 3.1 Solicitações (Portaria → Gate → Pátio → Saída)

- **Objeto:** `Solicitacao` com `protocolo` único, vínculo a `Cliente`, `StatusSolicitacao` (PENDENTE, APROVADO, CONCLUIDO, REJEITADO).
- **Sub-entidades 1:1:** `Portaria`, `Gate`, `Patio`, `Saida` — representam etapas do fluxo físico.

### 3.2 Unidades (contêiner / tipo / contexto)

- **Objeto:** `Unidade` (`unidades_solicitacao`): `numeroIso` único, `TipoUnidade` (IMPORT, EXPORT, GATE_IN, GATE_OUT).
- **Validação:** algoritmo ISO 6346 e pipes de negócio no backend.

### 3.3 Clientes (PJ / PF)

- **Objeto:** `Cliente` com `TipoCliente`, documento (`cpfCnpj` único), contatos e **soft delete** (`deletedAt`).

### 3.4 Cobranças, faturamento, NFS-e, boletos

- **Faturamento** por `clienteId` + `periodo` único; `valorTotal` consistente com soma de **itens** (`FaturamentoItem`).
- **Vínculo operacional:** `FaturamentoSolicitacao` associa solicitações ao período faturado.
- **NFS-e:** `NfsEmitida` (XML, número, status IPM, município IBGE, provedor).
- **Boletos:** `Boleto` com vencimento, valor e status de pagamento.

### 3.5 Auditoria operacional e de segurança

- **Tabela** `auditorias`: rastreio de quem alterou o quê, antes/depois em JSON, com índices para investigação e relatórios.

### 3.6 Agendamentos

- Conceito suportado no **portal** e em fluxos de **solicitação** (detalhes de UI e regras específicas evoluem com o produto; núcleo transacional permanece em `Solicitacao` e relacionamentos).

### 3.7 Tendências operacionais (IA)

- **IA operacional** e **IA preditiva:** indicadores locais (gargalos, demanda, anomalias heurísticas) — ver módulos correspondentes no backend.

### 3.8 Capacidades e saturação (Simulador Terminal)

- **Simulador** para cenários de capacidade, saturação, expansão e “what-if”, alinhado à estratégia de terminal sem alterar obrigatoriamente o banco transacional em modos simulados.

---

## 4. Módulos do sistema (organograma de software)

Para cada módulo abaixo: visão única de **função**, **integração**, **rotas exemplares**, **perfis**, **dados** e **métricas**.

### 4.1 Operador

| Dimensão | Descrição |
|----------|-----------|
| **O que faz** | Registro portaria (fotos, OCR auxiliar), gate (RIC), posição de pátio, saída; dashboards operacionais. |
| **Integração** | API Nest `solicitacoes`, `dashboard`, `nfse` (consulta conforme papel); app web em `/operador/*`. |
| **Rotas importantes** | `PATCH` em solicitações por etapa; `GET /dashboard` agregados; rotas específicas por controller de solicitações. |
| **Perfis** | `OPERADOR_PORTARIA`, `OPERADOR_GATE`, `OPERADOR_PATIO`; supervisão estendida via env (ex.: cockpit). |
| **Dados** | `portarias`, `gates`, `patios`, `saidas`, `unidades_solicitacao`. |
| **Métricas** | Tempo médio por etapa, filas, taxa de conformidade documental, uso de patio por quadra. |

### 4.2 Cliente

| Dimensão | Descrição |
|----------|-----------|
| **O que faz** | Consulta e aprovação de solicitações, visão financeira autorizada (boletos, NFS-e, faturamento). |
| **Integração** | `portal` corporativo + **CX** `/cliente/portal/*`; JWT `CLIENTE` com escopo `clienteId`. |
| **Rotas importantes** | `GET /cliente/portal/solicitacoes`, aprovações, rotas de financeiro portal. |
| **Perfis** | `CLIENTE` (Prisma) + IAM portal (`/portal/login`). |
| **Dados** | Leitura filtrada por `clienteId`; sem acesso a dados de outros clientes. |
| **Métricas** | SLA portal, tempo de aprovação, inadimplência e consumo por período. |

### 4.3 Motorista

| Dimensão | Descrição |
|----------|-----------|
| **O que faz** | Check-in, fila, rastreio de solicitação autorizada; integração com fluxo portuário. |
| **Integração** | `apps/web` em `/motorista/*`; API pode expor rotas dedicadas mobile/motorista. |
| **Rotas importantes** | Leitura de solicitação por protocolo/ID conforme regras de acesso. |
| **Perfis** | Autenticação motorista (sessão/cookie) + endpoints com validação de escopo. |
| **Dados** | Subconjunto da solicitação e status de gate/portaria. |
| **Métricas** | Tempo de espera, aderência a janelas, incidentes SSMA relacionados. |

### 4.4 Administrativo

| Dimensão | Descrição |
|----------|-----------|
| **O que faz** | Cadastro de clientes, usuários, configurações de pricing/comercial, governança de plataforma. |
| **Integração** | `clientes`, `auth`, `comercial-pricing`, `plataforma-integracao` (admin). |
| **Rotas importantes** | `POST /auth/users`; CRUD clientes; endpoints de API clients e tenant. |
| **Perfis** | `ADMIN`, `GERENTE` com permissões amplas. |
| **Dados** | `users`, `clientes`, metadados de integração. |
| **Métricas** | Crescimento de base, churn, uso de APIs B2B. |

### 4.5 Comercial / Pricing

| Dimensão | Descrição |
|----------|-----------|
| **O que faz** | Curva ABC, elasticidade, simulador de preço, séries temporais comerciais. |
| **Integração** | Módulo `comercial-pricing`. |
| **Rotas importantes** | Endpoints de análise e simulação (RBAC `comercial:pricing`). |
| **Perfis** | `ADMIN`, `GERENTE`. |
| **Dados** | Agregados derivados de faturamento e solicitações (consultas read/analytics). |
| **Métricas** | Margem, elasticidade estimada, contribuição por cliente. |

### 4.6 Financeiro

| Dimensão | Descrição |
|----------|-----------|
| **O que faz** | Faturamento, emissão/cancelamento NFS-e, boletos, conciliação, tesouraria (módulos em maturação). |
| **Integração** | `faturamento`, `financeiro-conciliacao`, `tesouraria`, `fiscal-governanca`. |
| **Rotas importantes** | `GET/POST/PATCH` faturamento; emissão IPM; webhooks financeiros em `/integracao/pagamentos`. |
| **Perfis** | `ADMIN`, `GERENTE`; cliente apenas leitura portal. |
| **Dados** | `faturamentos`, `faturamento_itens`, `nfs_emitidas`, `boletos`. |
| **Métricas** | Ciclo em dias (operação → faturamento), taxa de inadimplência, divergências fiscais. |

### 4.7 RH / DP

| Dimensão | Descrição |
|----------|-----------|
| **O que faz** | Folha, jornada, competências, performance (módulos `folha-rh`, `rh-performance`). |
| **Integração** | Endpoints dedicados; alguns fluxos com persistência evolutiva (memória → Prisma). |
| **Rotas importantes** | Contratos sob RBAC RH (supervisores por e-mail onde definido). |
| **Perfis** | `ADMIN`, `GERENTE`; operadores conforme política. |
| **Dados** | Entidades específicas por fase do produto. |
| **Métricas** | Custo por turno, absenteísmo, KPIs de produtividade humana. |

### 4.8 GRC (Governança, Risco, Compliance)

| Dimensão | Descrição |
|----------|-----------|
| **O que faz** | Riscos, controles, maturidade ISO/OEA/ISPS, planos de ação, leitura de incidentes. |
| **Integração** | `grc-compliance`; alinhado a auditoria e SSMA. |
| **Rotas importantes** | Leitura para gerência; POST restrito a papéis elevados em entidades sensíveis. |
| **Perfis** | `ADMIN`, `GERENTE`, supervisores configurados por env. |
| **Dados** | Registros de risco/controle; vínculos com evidências operacionais. |
| **Métricas** | Exposição residual, eficácia de controles, prazos de remediação. |

### 4.9 SSMA (Saúde, Segurança e Meio Ambiente)

| Dimensão | Descrição |
|----------|-----------|
| **O que faz** | Compliance SSMA, incidentes, PTW (permissão de trabalho), checklists. |
| **Integração** | Frontend `/ssma/*`; backend alinhado a políticas de incidente. |
| **Rotas importantes** | Formulários e listagens sob sessão staff. |
| **Perfis** | Staff autenticado (`rl_staff_session` + JWT). |
| **Dados** | Incidentes, evidências (imagens — boas práticas migrar para `next/image` onde aplicável). |
| **Métricas** | Frequência de incidentes, tempo de fechamento, taxa de conformidade em PTW. |

### 4.10 BI / IA

| Dimensão | Descrição |
|----------|-----------|
| **O que faz** | Painéis BI corporativo; IA operacional e preditiva (estatística local). |
| **Integração** | `datahub`, `ia-operacional`, `ia-preditiva`, rotas de dashboard financeiro/performance. |
| **Rotas importantes** | `GET` agregados; endpoints de previsão com RBAC restrito. |
| **Perfis** | Gestão e TI/Dados (via `DATAHUB_TI_EMAILS`). |
| **Dados** | DW em memória / catálogo Kimball (fase evolutiva); séries para modelos. |
| **Métricas** | MAPE de demanda, scores de anomalia, utilização de data products. |

### 4.11 Simulador Terminal

| Dimensão | Descrição |
|----------|-----------|
| **O que faz** | Cenários de capacidade, saturação, expansão, what-if estratégico. |
| **Integração** | `simulador-terminal`, `planejamento-estrategico`. |
| **Rotas importantes** | Endpoints de simulação sob JWT gerencial. |
| **Perfis** | `ADMIN`, `GERENTE`. |
| **Dados** | Parâmetros de pátio, filas, custos — muitos proxies configuráveis. |
| **Métricas** | Capacidade vs. demanda, investimento CAPEX/OPEX simulado. |

### 4.12 Digital Twin

| Dimensão | Descrição |
|----------|-----------|
| **O que faz** | Representação visual 2D/3D do terminal e fluxos, suporte a narrativa executiva. |
| **Integração** | Frontend `digital-twin`; dados dos mesmos serviços de dashboard/simulador. |
| **Rotas importantes** | Navegação Next protegida por middleware de sessão staff. |
| **Perfis** | Staff autenticado. |
| **Dados** | Agregados e estados sintéticos para visualização. |
| **Métricas** | Engajamento de uso, tempo de sessão analítica. |

### 4.13 AI-Console

| Dimensão | Descrição |
|----------|-----------|
| **O que faz** | Consolidação de insights por domínio (operacional, financeiro, estratégico). |
| **Integração** | Rotas `/ai-console/*`; consumo de APIs de IA e dashboards. |
| **Rotas importantes** | Páginas segmentadas por perfil. |
| **Perfis** | Staff seniores. |
| **Dados** | Respostas agregadas e metadados de confiança (evolutivo). |
| **Métricas** | Tempo de resposta assistida, taxa de aceitação de recomendações. |

### 4.14 Robotic Ops

| Dimensão | Descrição |
|----------|-----------|
| **O que faz** | Workflows, RPA interno, regras if/then, scheduler corporativo. |
| **Integração** | `automacao-processos`; eventos podem integrar ao barramento Fase 14. |
| **Rotas importantes** | `/automacao/*` (workflows, rpa, regras, estados). |
| **Perfis** | Criação/ativação restrita a `ADMIN`/`GERENTE` conforme endpoint. |
| **Dados** | Definições de workflow em memória até migração completa. |
| **Métricas** | Jobs executados, falhas, SLA de automação. |

### 4.15 AOG

| Dimensão | Descrição |
|----------|-----------|
| **O que faz** | Políticas de autonomia e disciplina operacional — “como a máquina pode agir”. |
| **Integração** | Combinação GRC + auditoria + limites em `automacao` + configuração em env. |
| **Rotas importantes** | Leitura executiva; alteração apenas papéis administrativos. |
| **Perfis** | Diretoria digital / compliance. |
| **Dados** | Políticas, limites, trilhas de exceção. |
| **Métricas** | Desvios de política, intervenções humanas. |

### 4.16 AGI-Ops

| Dimensão | Descrição |
|----------|-----------|
| **O que faz** | Camada-alvo de autonomia máxima com explicabilidade e reversão auditável. |
| **Integração** | Roadmap: AI-Console + Robotic Ops + twin + dados unificados. |
| **Rotas importantes** | A definir por fase; hoje não há “AGI endpoint” único. |
| **Perfis** | Governança central + auditoria. |
| **Dados** | Linhagem de dados e logs de decisão (futuro). |
| **Métricas** | ROI da automação, incidentes atribuídos a decisão automatizada. |

---

## 5. Modelo de dados (visão Prisma)

### 5.1 Diagrama lógico textual (entidades principais)

```
Cliente (1) ───────< (N) Solicitacao
                           │
                           ├── (N) Unidade  [unidades_solicitacao]
                           ├── (0..1) Portaria
                           ├── (0..1) Gate
                           ├── (0..1) Patio
                           ├── (0..1) Saida
                           └── (N) FaturamentoSolicitacao >── Faturamento
Cliente (1) ───────< (N) Faturamento
                           ├── (N) FaturamentoItem
                           ├── (N) NfsEmitida
                           ├── (N) Boleto
                           └── (N) FaturamentoSolicitacao

User (0..1) ──────── (1) Cliente   [usuarioPortal, clienteId opcional]

Auditoria: independente, chaveia tabela/registro e usuário ator.
```

### 5.2 Principais constraints

- **Unicidade:** `protocolo`, `numeroIso`, `cpfCnpj`, `email` (cliente/user), `numeroNfe`, `numeroBoleto`, par `(clienteId, periodo)` em faturamento, `(faturamentoId, solicitacaoId)`, `(quadra, fileira, posicao)` em pátio.
- **Integridade referencial:** `onDelete: Cascade` em vínculos operacionais críticos; `SetNull` em usuário→cliente quando aplicável.

### 5.3 Política de deleção (soft delete)

- Uso de **`deletedAt`** em `Cliente` e `Solicitacao` para preservar histórico e permitir conformidade; exclusão física apenas sob processo controlado e auditoria `SEGURANCA`.

### 5.4 Fluxo de auditoria e rastreabilidade

1. Toda ação sensível deve disparar `AuditoriaService.registrar` com **antes/depois**.
2. Ações de segurança (login, logout, mudança de permissão) mapeadas com `AcaoAuditoria` adequada.
3. Consultas de auditoria filtráveis por tabela, usuário e período (módulo `auditoria`).

---

## 6. Fluxos operacionais (E2E)

### 6.1 Recepção → Portaria → Gate → Pátio → Saída

```
[ Nova solicitação / importação ]
        │
        ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Portaria    │───▶│     Gate      │───▶│    Pátio      │───▶│    Saída      │
│ fotos, OCR,   │    │ RIC, liberação│    │ posição física│    │ registro hora │
│ placa, lacre  │    │ veicular      │    │ quadra/fileira│    │ de saída      │
└───────────────┘    └───────────────┘    └───────────────┘    └───────────────┘
        │                     │                    │
        └─────────────────────┴────────────────────┘
                              │
                              ▼
                  Status solicitacao → CONCLUIDO (quando regra de negócio atendida)
```

### 6.2 Aprovação no portal do cliente

1. Cliente autenticado (`Role.CLIENTE` + `clienteId`).
2. Lista filtrada de solicitações do próprio cliente.
3. Ação de aprovação (permissão `portal:solicitacao:aprovar`) com atualização de status e auditoria.

### 6.3 Faturamento consolidado

1. Consolidação por **cliente** e **período** (`Faturamento` único por par).
2. Itens (`FaturamentoItem`) somam ao `valorTotal`.
3. Vínculo explícito das solicitações incluídas (`FaturamentoSolicitacao`).

### 6.4 Geração da NFS-e

1. A partir de `Faturamento` elegível e permissões `nfse:*`.
2. Integração **IPM / Atende.Net** (configuração `nfse.config` e variáveis de ambiente).
3. Persistência em `NfsEmitida` com XML e trilha de status (`StatusIpm`).

### 6.5 Auditoria

- Toda transição relevante gera linha em `auditorias` com referência ao registro de negócio e ao ator (`usuario`).

### 6.6 Processos de exceção

- **Rejeição** de solicitação pelo cliente ou pela operação (status `REJEITADO` + motivo em payload auditável).
- **Retrabalho de portaria** (correção de fotos/OCR) com nova entrada de auditoria.
- **Divergência fiscal:** módulo `fiscal-governanca` e fila de conciliação.

### 6.7 SLA e ciclos

**Definição corporativa sugerida (parametrizável):**

| Métrica | Numerador / denominador | Fonte |
|--------|-------------------------|--------|
| **Ciclo portaria → saída** | `tempo(saida) - tempoinício(portaria)` | `portarias.createdAt`, `saidas.dataHoraSaida` |
| **SLA cliente aprovação** | Prazo entre disponibilização e `APROVADO` | `solicitacoes` + auditoria |
| **Lead time faturamento** | `faturamento.createdAt - último evento operacional** | `faturamentos`, `faturamento_solicitacoes` |
| **On-time NFS-e** | % emissões com `statusIpm = ACEITO` dentro do SLA interno | `nfs_emitidas` |

**Cálculo de SLA operacional (resumo):**  
Para cada solicitação, definir `T0` (criação ou liberação ao cliente) e `T_end` (marco contratual — ex.: saída ou conclusão). O **ciclo** é `T_end - T0`. Comparar a **meta contratual** (horas úteis, calendário portuário) e classificar **verde / âmbar / vermelho** conforme política comercial registrada em `integracao` ou tabela de SLA futura.

---

## 7. Segurança e compliance

### 7.1 Autenticação

- **JWT access** (header Bearer e/ou cookie HttpOnly `rl_at` quando `AUTH_HTTP_ONLY_COOKIES=1`).
- **Refresh** com segredo dedicado; opcionalmente cookie `rl_rt`.
- **Revogação:** incremento de `tokenVersion` no **logout**; validação em `JwtStrategy`.

### 7.2 CSRF (double-submit)

- Ativado por **`CSRF_ENABLED=1`**; cookie **`rl_csrf`** (legível) + header **`X-CSRF-Token`** em métodos mutáveis.
- Front pode habilitar com **`NEXT_PUBLIC_CSRF_ENABLED=1`** (`lib/csrf-client.ts`).
- Rotas máquina-máquine e mobile permanecem isentas conforme `security.config.ts`.

### 7.3 RBAC + PBAC

- RBAC: enum `Role` no banco.
- PBAC: lista de permissões por papel; **PermissionsGuard** + decorator `@Permissions()`.

### 7.4 Rate limiting

- Limite global por IP (`express-rate-limit`), com exclusões para health e rotas públicas/mobile conforme `http-stack.ts`.

### 7.5 Helmet, CORS, CSP

- **Helmet** no backend (CSP desativada no servidor API para não conflitar com Swagger — CSP forte no **Next.js**).
- **CORS** por lista explícita de origens (`CORS_ORIGIN` ou variáveis por ambiente).
- **CSP** no `next.config.mjs` (script-src restrito, connect-src com API, img-src com CDN).

### 7.6 Auditoria sensível

- Uso de `READ` e **`SEGURANCA`** onde o acesso expõe dados pessoais ou configuração crítica; revisão periódica de consultas administrativas.

### 7.7 Controle de escopo

- **`clienteId`** no JWT para usuários portal; queries **sempre** filtradas no serviço (defesa em profundidade além do guard).

### 7.8 LGPD (política interna recomendada)

- **Minimização:** coletar apenas dados necessários à prestação do serviço logístico.
- **Base legal:** contrato + legítimo interesse operacional documentado.
- **Direitos do titular:** canal definido com o DPO; exportação e exclusão com **soft delete** e trilha em `auditorias`.
- **Subprocessadores:** infraestrutura de nuvem e provedor fiscal listados em contrato de prestador.

### 7.9 Retenção de dados

- **Operacionais / fiscais:** retenção alinhada à legislação tributária (mínimo 5 anos para documentos fiscais — validar com assessoria).
- **Logs:** rotação com política de retenção (ex.: 90 dias hot, 1 ano warm) configurável no coletor.
- **Backups:** criptografia em repouso e teste de restauração trimestral (recomendado).

---

## 8. Observabilidade e SRE

| Camada | Implementação / diretriz |
|--------|---------------------------|
| **Logs estruturados** | Winston JSON com `requestId` (`request-id.middleware.ts`). |
| **Métricas Prometheus** | Builder textual no módulo `observabilidade`. |
| **Healthcheck** | `GET /health` com dependências (DB, Redis). |
| **APM futuro** | OpenTelemetry + exportador OTLP para Datadog/New Relic/Grafana Cloud (roadmap). |
| **Alertas** | Regras sugeridas: taxa 5xx, latência p95 auth, falhas NFS-e, fila Redis, espaço em disco DB. |

**SLO exemplo:** disponibilidade API ≥ 99,5% mensal; latência p95 autenticação &lt; 500 ms (excl. cold start).

---

## 9. Ambientes e DevOps

| Ambiente | Finalidade | Características |
|----------|------------|-----------------|
| **DEV** | Desenvolvimento local | Docker Compose, hot reload, Swagger padrão ativo, CSRF opcional desligado. |
| **QA / CI** | Integração contínua | Banco efêmero em job, `prisma migrate deploy`, suíte Jest + E2E. |
| **STAGING** | Near-prod | Mesmas flags que produção, dados anonimizados. |
| **PROD** | Operação real | `NODE_ENV=production`, CORS estrito, cookies Secure, Swagger desligado salvo exceção, CSRF conforme risco. |

**Pipeline (resumo):** checkout → `npm ci` → Prisma validate/migrate → build backend → testes unitários e E2E → `npm audit --production` → build frontend (`next build`) → artefato opcional de código-fonte consolidado.

---

## 10. Roadmap evolutivo

### 10.1 Fases 1 a 6 (macro)

| Fase | Foco |
|------|------|
| **1** | Núcleo Nest + Prisma + auth + clientes + solicitações básicas. |
| **2** | PDFs, constraints de documento, endurecimento de dados. |
| **3** | Faturamento, portal financeiro, NFS-e, boletos. |
| **4** | Integração mobilidade, webhooks, cliente-api. |
| **5** | Observabilidade, IA preditiva local, fiscal/governança. |
| **6** | Plataforma pública B2B, datahub, automação, CX portais, mobile hub, cockpit. |

### 10.2 Fase autônoma

- Consolidação **AI-Console + Robotic Ops + Digital Twin** com políticas AOG explícitas e KPIs de confiança.

### 10.3 Fase AGI-Ops (nível 5)

- Motor de decisão com **explicabilidade**, **simulação prévia** (twin), **rollback** e **auditoria por decisão**; human-in-the-loop configurável por classe de risco.

### 10.4 ROI da automação (modelo)

- **Economia** = (horas administrativas evitadas × custo carregado) + (redução de multas SLA × probabilidade) − (custo de implementação + manutenção).
- **Payback** típico em operações maduras: 12–24 meses para automação de faturamento + portal; acelerado se integração fiscal reduzir retrabalho.

---

## 11. Anexos

### 11.1 Tabela resumida de permissões (PBAC)

*Extrato derivado de `ROLE_PERMISSIONS` — consultar `apps/backend/src/common/constants/role-permissions.ts` para lista completa.*

| Permissão (exemplos) | ADMIN | GERENTE | PORTARIA | GATE | PATIO | CLIENTE |
|----------------------|:-----:|:-------:|:--------:|:----:|:-----:|:-------:|
| `solicitacoes:portaria` | ✓ | ✓ | ✓ | — | — | — |
| `solicitacoes:gate` | ✓ | ✓ | — | ✓ | — | — |
| `solicitacoes:patio` | ✓ | ✓ | — | — | ✓ | — |
| `solicitacoes:saida` | ✓ | ✓ | — | ✓ | — | — |
| `nfse:emitir` | ✓ | ✓ | — | — | — | — |
| `portal:solicitacao:aprovar` | — | — | — | — | — | ✓ |
| `auditoria:ler` | ✓ | ✓ | — | — | — | — |

### 11.2 Modelo de auditoria (campos)

| Campo | Significado |
|-------|-------------|
| `tabela` | Nome lógico da entidade (`solicitacoes`, `users`, …). |
| `registroId` | UUID ou identificador da linha afetada. |
| `acao` | INSERT / UPDATE / DELETE / READ / SEGURANCA. |
| `usuario` | ID do usuário ator. |
| `dadosAntes` / `dadosDepois` | Snapshot JSON para investigação. |
| `createdAt` | Carimbo de tempo UTC. |

### 11.3 ISO 6346 e validações

- **ISO 6346:** código de identificação de contêiner (check digit). Implementação via pipes/validadores no backend (`iso6346` / validação de unidade).
- **Placas Mercosul:** validação em fluxos portuários onde aplicável (`mercosul-plate`).

### 11.4 Regras de negócio oficiais (síntese)

1. **Um faturamento por cliente e período** (`@@unique([clienteId, periodo])`).
2. **`valorTotal`** do faturamento deve refletir a **soma dos itens** (serviço de domínio).
3. **Solicitação** só avança de etapa com permissão PBAC correspondente.
4. **Cliente** só enxerga registros com **`clienteId`** igual ao do token.
5. **Logout** invalida tokens existentes via **`tokenVersion`**.

### 11.5 Glossário

| Termo | Definição |
|-------|-----------|
| **RIC** | Registro/termo de responsabilidade ou controle no gate (contexto gate-in). |
| **NFS-e** | Nota fiscal de serviço eletrônica. |
| **PBAC** | Control de acesso baseado em permissões granulares. |
| **Twin** | Gêmeo digital — modelo operacional espelhado do terminal. |
| **AOG** | Governança de operações autônomas. |

### 11.6 Diagrama ASCII da arquitetura (implantação)

```
                    ┌──────────────┐
                    │   CDN / WAF  │
                    └──────┬───────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
     ┌─────────────────┐       ┌─────────────────┐
     │   Next.js (SSR) │       │  NestJS API     │
     │   Vercel / VM   │       │  VM / K8s       │
     └────────┬────────┘       └────────┬────────┘
              │                         │
              │              ┌─────────┴─────────┐
              │              ▼                   ▼
              │      ┌──────────────┐    ┌──────────────┐
              └─────▶│  PostgreSQL  │    │    Redis     │
                     └──────────────┘    └──────────────┘
```

---

*Fim do Blueprint RL Transportes v1.0 — documento vivo; alterações devem passar por revisão de arquitetura e compliance antes da publicação externa.*
