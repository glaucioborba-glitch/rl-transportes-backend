# RL TRANSPORTES — BLUEPRINT GLOBAL DA PLATAFORMA

Versão: 1.0.0  
Responsável: Arquitetura Corporativa  
Status: Ativo

---

## 1. VISÃO EXECUTIVA

A Plataforma RL é um ecossistema corporativo integrado, cobrindo:

- Operações (Portaria, Gate, Pátio, Saída)
- Comercial e Pricing
- Financeiro (Faturamento, Boletos, NFS-e, ABC, Margens)
- Administrativo e Contratos
- RH/DP (jornada, turnos, NR)
- SSMA (Segurança, Saúde, Meio Ambiente)
- GRC (Governança, Riscos e Conformidade)
- BI/IA (gargalos, saturação, forecasts)
- Digital Twin 2D/3D
- AI-Console (copiloto)
- Robotic Ops (automações inteligentes)
- AGI-OPS (autonomia total, autoaprendizagem e autocorreção)
- Portal do Cliente
- Portal do Operador
- Portal do Motorista

Valor central:

**Operação como sistema vivo: auditado, preditivo, autônomo e convergente.**

---

## 2. ARQUITETURA TÉCNICA

Tecnologias:

- Backend: NestJS (TS) + Prisma + PostgreSQL + Redis
- Autenticação: JWT + Refresh Token + Cookies HttpOnly
- Segurança:
  - Helmet
  - CORS estrito
  - CSRF (Double Submit Token)
  - RBAC (Role-Based Access Control)
  - PBAC (Permission-Based Access Control)
  - Auditoria completa (INSERT/UPDATE/DELETE/READ/SEGURANCA)
- Frontend: Next.js 14 (App Router) + React Server Components onde aplicável — ver `apps/web/package.json` para versão exata
- Infra: Docker + Docker Compose
- Observabilidade: prometheus + winston logs estruturados

**Integrações (NFS-e, OCR, Mobile):**

- **NFS-e:** conector municipal (IPM) para emissão, cancelamento e consulta (detalhes em §9).
- **OCR:** captura e leitura assistida de placa, identificador ISO e lacre na portaria/gate (detalhes em §3 e §5).
- **Mobile:** check-in, senha/QR, fila e chamadas do portal do motorista (detalhes em §6).

Camadas:

- Core (AppModule)
- Operações
- Financeiro
- Comercial
- Portal Cliente
- Portal Operador
- Portal Motorista
- Dashboard Operacional
- Dashboard Financeiro
- Dashboard Performance
- Simulador
- IA Operacional
- Auditoria
- GRC
- SSMA
- Digital Twin
- AI-Console
- Robotic Ops
- AGI-OPS

---

## 3. FLUXO OPERACIONAL CORE (Portaria → Gate → Pátio → Saída)

1. Portaria
   - Cadastro/Identificação
   - Fotos, OCR (placa, ISO, lacre)
   - Auditoria de entrada

2. Gate
   - Conferência + alteração audível
   - RIC e assinatura digital
   - Validação de ISO 6346 e tipo

3. Pátio
   - Movimentação
   - Hotspots
   - Saturação por quadra
   - Recomendações IA (balanceamento)

4. Saída
   - Conferência final
   - Impressão do recibo A4
   - Auditoria de saída

---

## 4. PORTAL DO CLIENTE

Funcionalidades:

- Solicitações
- Agendamentos
- Aprovação
- Containerização
- Faturamento + NFS-e + Boletos
- Auditoria
- Tracking completo

Segurança:

- PBAC por clienteId
- Auditoria READ

---

## 5. PORTAL DO OPERADOR

- Operações operacionais (portaria/gate/pátio)
- OCR integrado
- Telemetria por turno
- Trilha de auditoria individual

---

## 6. PORTAL DO MOTORISTA

- Check-in mobile
- Senha eletrônica
- QR Code
- Fila com posição
- Chamada de pátio
- Tracking da operação

---

## 7. PAINÉIS EXECUTIVOS

### Dashboard Operacional

- Snapshot / SLA / Filas / Conflitos / Telemetria

### Dashboard Performance

- Estratégia operacional
- Produtividade humana
- Gargalos
- Custos proxy
- Séries temporais

### Dashboard Financeiro

- Receita / Aging / Inadimplência / ABC / Margens / Forecast

---

## 8. COMERCIAL & PRICING

- Elasticidade de demanda
- Simulador (what-if)
- Curva ABC Híbrida (lucro + margem + volume)
- Pricing Engine

---

## 9. FINANCEIRO

- NFS-e municipal (IPM)
- Emissão + cancelamento + consulta
- Boletos
- Itens de faturamento
- Integrações de período

---

## 10. GRC — GOVERNANÇA, RISCO E COMPLIANCE

- COSO (controles internos)
- ISO 31000 (risk management)
- Matriz 5x5
- Policy Engine
- AOG (Autonomous Operations Governance — governança de operações autônomas; políticas, disciplina e self-regulation alinhadas ao risco)
- Auditoria sensível (READ/SEGURANCA)

---

## 11. SSMA — Segurança, Saúde, Meio Ambiente

- Incident Management
- PTW (Permissão de Trabalho)
- Mapa de risco do pátio
- EPI/EPC tracker
- NR Compliance Room

---

## 12. DIGITAL TWIN (2D e 3D)

- Mapa operacional em tempo real
- Fluxos animados
- Saturação + riscos
- Visualização espacial
- Simulação de impacto em quadras

---

## 13. AI-CONSOLE (Copiloto Operacional)

- Natural Language Ops
- Diagnóstico automático
- Recomendação contextual
- Causas prováveis
- Priorizações inteligentes

---

## 14. ROBOTIC OPS (Automação Inteligente)

- Autopilot operacional
- Auto-alertas
- Auto-balanceamento
- Auto-execução simulada

---

## 15. AGI-OPS (Autonomia Nível 5)

- Self-learning
- Self-correcting
- Self-optimizing
- Comportamento emergente
- Governança adaptativa

---

## 16. SEGURANÇA (Resumo Final)

- JWT + Refresh com tokenVersion
- Cookies HttpOnly + Secure
- SameSite=none quando multi-domínio
- CSRF (Double Submit Token)
- Helmet + HSTS
- Auditoria completa
- RBAC + PBAC
- CORS restrito
- XSS, CSP, FrameGuard, ReferrerPolicy

---

## 17. PADRÕES DO SISTEMA

- DTOs com class-validator
- Pipes de validação:
  - CPF/CNPJ
  - ISO 6346
  - Mercosul
- Prisma com IsolationLevel SERIALIZABLE
- Auditoria obrigatória nas mutações
- Versionamento de API: /v1

---

## 18. ROADMAP DE CURTO, MÉDIO E LONGO PRAZO

Versão 1.1 (Curto prazo / 30d)

- Hardening final
- CSP completa
- CSRF ON em todos os ambientes
- Observabilidade

Versão 1.2 (60–90d)

- Portal Motorista MVP Real
- Mobile offline

Versão 1.5 (120–180d)

- IA Operacional avançada (clusterização)
- Digital Twin 3D completo

Versão 2.0 (1 ano)

- AGI-OPS com self-learning ativo
- Robotic Ops para fluxos completos
- Terminal semiautônomo

---

## 19. GLOSSÁRIO

### Terminologia operacional

| Termo | Definição |
|-------|-----------|
| **Portaria** | Etapa de entrada: identificação do veículo/unidade, registro fotográfico e checagens iniciais. |
| **Gate** | Controle de acesso físico/lógico; conferência, RIC e liberação para circulação interna. |
| **Pátio** | Área de armazenagem temporária; posicionamento por quadra/fileira/posição. |
| **Saída** | Conferência final e liberação para retirada, com recibo e auditoria. |
| **RIC** | Registro/Instrumento de Controle associado ao fluxo de gate (assinatura e responsabilização). |
| **Hotspot** | Zona de maior concentração ou risco operacional no pátio (saturação, fila, incidente). |
| **Recibo A4** | Documento padronizado de término ou comprovação de etapa/saída. |

### Siglas técnicas

| Sigla | Significado |
|-------|-------------|
| **API** | Application Programming Interface |
| **JWT** | JSON Web Token |
| **RBAC** | Role-Based Access Control |
| **PBAC** | Permission-Based Access Control |
| **CSRF** | Cross-Site Request Forgery |
| **CSP** | Content Security Policy |
| **HSTS** | HTTP Strict Transport Security |
| **CORS** | Cross-Origin Resource Sharing |
| **OCR** | Optical Character Recognition |
| **NR** | Normas Regulamentadoras (Brasil) |
| **PTW** | Permit to Work (Permissão de Trabalho) |
| **EPI/EPC** | Equipamento de Proteção Individual / Coletiva |
| **IPM** | Provedor/integração municipal de NFS-e (contexto Atende.Net / município) |
| **SLA** | Service Level Agreement |
| **ABC** | Curva de classificação por contribuição (ex.: receita, margem, volume) |
| **AOG** | Autonomous Operations Governance — governança de operações autônomas (políticas, limites e auditoria). |

### Papéis e permissões (visão negócio)

| Papel | Escopo típico |
|-------|----------------|
| **ADMIN** | Configuração, usuários, operações e financeiro sem limite funcional. |
| **GERENTE** | Operação e finanças com aprovações e relatórios executivos. |
| **OPERADOR_PORTARIA** | Etapa portaria e leituras associadas. |
| **OPERADOR_GATE** | Etapa gate e saída quando permitido pela política. |
| **OPERADOR_PATIO** | Posicionamento e movimentação no pátio. |
| **CLIENTE** | Portal: solicitações, aprovações e financeiro do próprio cadastro (`clienteId`). |

### Definições NFS-e

| Termo | Definição |
|-------|-----------|
| **NFS-e** | Nota Fiscal de Serviços eletrônica, documento fiscal municipal. |
| **Emissão** | Geração e transmissão da NFS-e ao ambiente autorizado. |
| **Cancelamento** | Invalidação dentro das regras do município e do conector. |
| **XML** | Representação estruturada da nota para arquivo e integração. |
| **Período de faturamento** | Janela temporal (ex.: mensal) para consolidação de itens e notas. |

### Definições IA / Twin / AGI

| Termo | Definição |
|-------|-----------|
| **IA Operacional** | Modelos e heurísticas para previsão de filas, gargalos e recomendações táticas. |
| **BI/IA** | Camada de indicadores, séries e análises (incluindo predição local onde aplicável). |
| **Digital Twin** | Modelo vivo do terminal (2D/3D) sincronizado conceitualmente com o estado operacional. |
| **AI-Console** | Copiloto: interface de diagnóstico, recomendação e priorização assistida. |
| **Robotic Ops** | Automações com workflows, alertas e execução controlada (incl. modo simulado). |
| **AGI-OPS** | Visão-alvo de autonomia nível 5: aprendizado, correção e otimização com governança adaptativa. |

---

*Documento mestre versionado. Alterações de baseline exigem registro de versão, aprovação de arquitetura e comunicação às áreas de compliance e operações.*
