# RL Transportes — Prompt operacional (consolidado)

Fonte: diretrizes do projeto (abril/2026). Documento de referência para continuidade do desenvolvimento.

## Pilares

1. Estabilidade e resiliência  
2. Segurança e validação server-side rigorosa  
3. Fluidez operacional (fluxos logísticos)  
4. Auditoria completa e rastreabilidade  
5. Arquitetura modular (módulos NestJS desacoplados)  
6. Escalabilidade  
7. Domínio logístico (contêineres, terminal, transporte)  
8. Qualidade de código (testável, manutenível)

## Stack

NestJS, TypeScript, PostgreSQL, Prisma, Redis, JWT + refresh, RBAC, class-validator nos DTOs.

## Diretrizes obrigatórias

- Não inventar regras de negócio além do solicitado.  
- Manter modularidade; validação forte no backend.  
- Registrar operações sensíveis na auditoria.  
- Preferir soluções sustentáveis e seguras em todas as camadas.

## Estrutura de resposta sugerida (para novas funcionalidades)

- Diagnóstico técnico  
- Plano de implementação  
- Arquivos afetados  
- Código necessário (trechos centrais)  
- Riscos e observações  
- Próximo passo recomendado

## Fases (ordem de referência)

1. Base: Nest, Prisma, PostgreSQL, Redis, env, health, logs  
2. Autenticação: login, refresh, JWT, guards, RBAC  
3. Usuários e perfis (User, papéis/permissões)  
4. Clientes (CRUD, CPF/CNPJ)  
5. Solicitações e unidades  
6. Auditoria (registro e **consulta** de eventos)  
7. Portaria / Gate (entrada e saída, placas, fotos via API)  
8. Pátio (localização de contêineres, ocupação)  
9. Faturamento e itens  
10. Integrações fiscais (NFS-e mock, parceiros)  
11. Portal do cliente  
12. Relatórios e dashboards  
13. Mobile / recepção (APIs otimizadas, upload/captura)  
14. Testes automatizados e documentação OpenAPI

## Checklist pós-desenvolvimento (produção)

Funcionalidades completas; testes; validação de entrada; RBAC; proteções comuns (SQLi, XSS, CSRF); segredos; performance e queries; cache Redis; tratamento de erros; auditoria consultável; Swagger atualizado; conformidade e UX de API.

---

*Texto sintetizado para o repositório; o detalhamento normativo permanece no documento PDF original do solicitante.*
