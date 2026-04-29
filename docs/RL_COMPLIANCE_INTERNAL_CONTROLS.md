# RL COMPLIANCE & INTERNAL CONTROLS

Versão: 1.0.0  
Status: Ativo  
Responsável: Compliance + Comitê de Arquitetura + Admin Sistema  

---

# 1. PROPÓSITO DO SISTEMA DE COMPLIANCE

Este documento define:

- Como a RL Transportes assegura **conformidade legal, regulatória e operacional**  
- Como são implementados **controles internos corporativos**  
- Como é garantida **integridade, rastreabilidade, anticorrupção e antifraude**  
- Como governar riscos e mitigar falhas sistêmicas e humanas  

Baseado em:

- **ISO 37301 – Compliance Management Systems**  
- **ISO 31000 – Risk Management**  
- **COSO Internal Control Integrated Framework**  
- **SOX-lite – Controles de TI e Financeiro**  
- **LGPD – Tratamento de dados pessoais**  

---

# 2. PRINCÍPIOS DE COMPLIANCE RL

1. **Legalidade acima de tudo**  
   - Todas as regras seguem legislação fiscal, societária, LGPD e regulamentos SSMA.

2. **Transparência**  
   - Cada ação mutável no sistema gera rastro audível.

3. **Accountability clara**  
   - Cada operação, módulo e entidade tem um responsável primário.

4. **Segregação de funções (SoD)**  
   - Ninguém pode executar um ciclo completo sem contra-verificação.

5. **Prevenção > Detecção**  
   - Controles preventivos preferidos a corretivos.

6. **Zero Blind Spots**  
   - Toda alteração relevante é monitorada, auditada e registrada.

---

# 3. MODELO COSO APLICADO À RL

## 3.1. Ambiente de Controle

- RBAC/PBAC implementado
- Políticas e permissões explícitas
- Admin Sistema como autoridade máxima técnica

## 3.2. Avaliação de Riscos

- Modos operacional, financeiro, comercial, SSMA, jurídico
- Classificação por severidade: crítico, alto, médio, baixo

## 3.3. Atividades de Controle

- Auditoria automática server-side
- Transações isoladas (SERIALIZABLE)
- Controles de integridade em NFS-e, faturamento e movimentação de pátio

## 3.4. Informação e Comunicação

- Logs estruturados
- Painéis de conformidade
- Alertas do AOG (Autonomous Ops Governance)

## 3.5. Monitoramento

- Auditoria contínua
- Revisão periódica de compliance
- Métricas de risco via dashboard financeiro e operacional

---

# 4. CONTROLES INTERNOS ESTRUTURADOS

## 4.1. Controles de Autenticação

- JWT + Refresh Token
- TokenVersion para revogação
- Cookies HttpOnly + Secure
- CSRF habilitado (double-submit)

## 4.2. Controles de Autorização

- RBAC para macroperfis
- PBAC para granularidade (ex.: faturamento:criar)
- Escopo clienteId obrigatório no portal do cliente

## 4.3. Controles de Auditoria

Geração automática de:

- INSERT  
- UPDATE  
- DELETE  
- READ sensível  
- SEGURANCA (tentativa fora de escopo / fraude)  

## 4.4. Controles Financeiros

- Vinculação obrigatória de solicitação ao cliente  
- Histórico inviolável de unidade/ISO  
- Conferência antifraude entre operações e faturamentos  
- Regras de NFS-e e boletos validadas com Sefaz / IPM  

## 4.5. Controles Operacionais

- Gate não pode registrar saída sem portaria  
- Saída não pode existir sem pátio  
- ISO duplicado aciona controle crítico  
- Operação fica travada em estados inválidos

## 4.6. Controles de Segurança da Informação

- Helmet  
- CSP rígido  
- Anti-XSS integrado  
- Anti-Clickjacking (X-Frame-Options: DENY)  
- Logs com IP, userAgent, usuário, permissões  

---

# 5. FRAMEWORK DE COMPLIANCE (ISO 37301)

## 5.1. Liderança

- Admin Sistema garante implementação técnica
- Diretoria patrocina iniciativas de conformidade

## 5.2. Avaliação de Riscos de Compliance

Focos:

- Fiscal (NFS-e)
- Financeiro (boletos, faturamento)
- Operacional (gate/pátio)
- LGPD (dados pessoais)
- SSMA (incidentes, PTW)

## 5.3. Controles Preventivos

- Validação obrigatória de dados  
- Fluxos restritos  
- Travas técnicas baseadas em regras  

## 5.4. Tratamento de Incidentes

Passos:

1. Detecção  
2. Análise  
3. Registro  
4. Mitigação  
5. Comunicação ao comitê  

---

# 6. SOX-LITE: PREVENÇÃO DE FRAUDE E MANIPULAÇÃO

## 6.1. Controles sobre movimentações

- Todas atualizações de status são auditadas  
- Transições inválidas → bloqueio automático  

## 6.2. Controles sobre faturamento

- Nenhuma operação pode ser faturada sem saída  
- Regras antifraude para valores inconsistentes  
- Auditoria contínua de NFS-e, falhas de retorno e divergências

## 6.3. Logs imutáveis

- Auditorias registradas com before/after
- Nenhuma alteração de auditoria é permitida

---

# 7. SEPARAÇÃO DE FUNÇÕES (SOD)

Segregação obrigatória:

- Quem recebe não fatura
- Quem fatura não cria unidades
- Quem altera cliente não aprova solicitação
- Quem aprova não executa operação

---

# 8. COMPLIANCE OPERACIONAL

## 8.1. Evitar estados ilegais

- Gate sem portaria → evento de conflito
- Saída sem pátio → evento de conflito
- ISO duplicado → evento de risco

## 8.2. Controles de processo

- Portaria → Gate → Pátio → Saída é imutável
- Número ISO validado rigorosamente
- Placa Mercosul validada

---

# 9. COMPLIANCE FINANCEIRO-FISCAL

## 9.1. Faturamento

- Registro auditável
- Itens obrigatórios
- Valor total deve ser soma das linhas

## 9.2. NFS-e

- Controles antifalha por integração municipal
- Verificação do código de autenticidade
- Reconciliação periódica dos registros locais vs IPM

---

# 10. RACI DO SISTEMA DE COMPLIANCE (sem tabelas)

**Gestão de Compliance Geral**  
- R: Compliance  
- A: Diretoria  
- C: Admin Sistema  
- I: Auditoria  

**Controles Internos COSO**  
- R: Admin Sistema  
- A: Comitê de Arquitetura  
- C: Auditoria  
- I: Operações  

**Controles Financeiros**  
- R: Financeiro  
- A: Diretoria  
- C: Auditoria  
- I: Comercial  

**NFS-e e Obrigações Fiscais**  
- R: Financeiro  
- A: Admin Sistema  
- C: Auditoria  
- I: Diretoria  

**Processos Operacionais (Portaria/Gate/Pátio/Saída)**  
- R: Operações  
- A: Comitê Operacional  
- C: Admin Sistema  
- I: Financeiro  

**Incidentes SSMA**  
- R: Segurança/SSMA  
- A: Comitê Operacional  
- C: Admin Sistema  
- I: Diretoria  

---

# 11. ROADMAP DE CONFORMIDADE

**0–30 dias**  
- Auditoria READ e SEGURANCA ativa  
- Regras antibypass completas

**30–90 dias**  
- Dashboard de risco operacional  
- Dashboard de risco financeiro  
- Painel de conformidade GRC

**90–180 dias**  
- Compliance automatizado por AOG  
- GRC com scoring  
- Prevenção ativa via Robotic Ops  

---

# Instrução Final

Gerar o arquivo:  
docs/RL_COMPLIANCE_INTERNAL_CONTROLS.md  
com TODO o conteúdo acima, sem alterações funcionais no código.
