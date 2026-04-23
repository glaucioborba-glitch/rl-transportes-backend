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
10. Integrações fiscais (NFS-e IPM Navegantes, parceiros)  
11. Portal do cliente  
12. Relatórios e dashboards  
13. Mobile / recepção (APIs otimizadas, upload/captura)  
14. Testes automatizados e documentação OpenAPI

## Checklist pós-desenvolvimento (produção)

Funcionalidades completas; testes; validação de entrada; RBAC; proteções comuns (SQLi, XSS, CSRF); segredos; performance e queries; cache Redis; tratamento de erros; auditoria consultável; Swagger atualizado; conformidade e UX de API.

## Estado da base (atualização estrutural)

- **Auth:** JWT inclui `tv` (`users.tokenVersion`). **Logout** (`POST /auth/logout`) incrementa a versão e invalida access/refresh anteriores; **refresh** exige `tv` alinhado ao banco. Eventos **LOGIN_SUCCESS** e **LOGOUT** gravados em `auditorias` (tabela lógica `auth`). **POST /auth/users** (ADMIN) cria usuário em transação e grava auditoria `INSERT` na tabela lógica `users`; resposta de login/issue tokens inclui `clienteId` quando existir. Migration: `tokenVersion` em `users` — aplicar com `npx prisma migrate deploy` (produção) ou `migrate dev` (dev).
- **Health:** `GET /health` valida PostgreSQL e Redis (`checks.database`, `checks.redis`); `status` pode ser `ok` ou `degraded` se um dos serviços falhar.
- **Clientes:** listagem com `ClientePaginationDto` (busca em nome, e-mail e CPF/CNPJ); ordenação restrita a `createdAt`, `nome`, `email` no serviço (defesa em profundidade). Perfil **CLIENTE**: listagem e detalhe limitados ao próprio `users.clienteId` (sem acesso a outros cadastros); sem vínculo retorna 403.
- **Solicitações:** rotas `POST /solicitacoes/gate`, `patio`, `saida` com RBAC, transação e auditoria por registro operacional. Escopo **CLIENTE**: listagem/detalhe restringidos ao `User.clienteId`; `PATCH` em `/portal/solicitacoes/:id/aprovar` (pendente → aprovado) usa o mesmo `findOne` com escopo em toda a atualização de status.
- **Faturamento / NFS-e / boletos:** `Faturamento` por `clienteId` + período `YYYY-MM` (único), vínculos operacionais em `faturamento_solicitacoes`. NFS-e emitida via **IPM/Atende.Net** (Web Service REST NTE-35/2021); `nfs_emitidas` guarda XML de retorno, número, `referenciaExterna` (código de autenticidade, até 255), `provedor=ipm-atende-navegantes`, `municipioIbge` padrão Navegantes. Boletos vinculados ao faturamento.
- **Portal cliente:** rotas em `/portal/*` (mesmas permissões de leitura + `portal:solicitacao:aprovar`). Requer usuário com `users.clienteId` preenchido. Inclui `GET /portal/boletos` (paginação) para acompanhamento de cobrança. Listagem de solicitações no portal não aceita filtro por outro `clienteId` (escopo só pelo vínculo do usuário).
- **Faturamento / NFS-e:** emissão real `POST /faturamento/:id/nfse` (corpo `EmitirNfseDto`: RPS, serviço — item de lista, atividade, local, alíquota, descritivo multilinha — e tomador completo). Cancelamento `POST /faturamento/:id/nfse/cancelar` (`CancelarNfseDto`: motivo; série padrão `1`). Consulta `GET /nfse/:identificador` pelo **código de autenticidade** (40 caracteres). RBAC: permissões `nfse:emitir`, `nfse:cancelar`, `nfse:consultar` (ADMIN/GERENTE); **CLIENTE** não emite. Auditoria com `ip` / `user-agent` em `INSERT`/`UPDATE` de `nfs_emitidas` e `faturamentos`. Ambiente: `NFSE_IPM_SENHA` obrigatória para transmitir; nunca logar credenciais.
- **Relatórios:** resumos `GET /relatorios/operacional/solicitacoes` e `GET /relatorios/financeiro/faturamento` (ADMIN/GERENTE); listas paginadas `GET .../operacional/solicitacoes/lista` e `GET .../financeiro/faturamento/lista`; filtro opcional `clienteId` no resumo financeiro e nas listas (herdado de `RelatorioQueryDto` / `RelatorioListaQueryDto`). Períodos com datas inválidas ou fora de ordem retornam 400.
- **Testes:** `npm test` (unitário; inclui builder/parser IPM e `NfseService`) e `npm run test:e2e` (`/health` e `GET /nfse` sem token → 401).

### NFS-e — fluxo técnico (referência)

1. **Emissão:** monta XML ISO-8859-1 com tags alinhadas ao export da nota real (ex. nº 430) e à NTE-35; `POST` `multipart/form-data` campo `File`, `Authorization: Basic` (CNPJ:senha em base64); processamento síncrono; retorno XML com `numero_nfse`, `link_nfse`, `cod_verificador_autenticidade`, `chave_acesso_nfse_nacional` quando retorno completo/homologação.
2. **Cancelamento:** XML com `numero_nfse`, `serie_nfse`, `tipo` = `C`, `motivo_cancelamento`, bloco `prestador`; respostas podem ser imediatas, **pendente de análise** (município) ou rejeição — o serviço propaga mensagens do provedor sem inventar prazo local.
3. **Consulta:** XML com `pesquisa` / `codigo_autenticidade`; útil para sincronizar situação e atualizar registro local se a nota estiver cancelada no município.

**Exemplo (trecho) — corpo XML de emissão** (estrutura; valores de exemplo):

```xml
<?xml version="1.0" encoding="ISO-8859-1"?>
<nfse>
  <rps>
    <nro_recibo_provisorio>225</nro_recibo_provisorio>
    <serie_recibo_provisorio>RPS</serie_recibo_provisorio>
    <data_emissao_recibo_provisorio>22/04/2026</data_emissao_recibo_provisorio>
    <hora_emissao_recibo_provisorio>16:30:00</hora_emissao_recibo_provisorio>
  </rps>
  <nf>
    <data_fato>22/04/2026</data_fato>
    <valor_total>5.840,00</valor_total>
    <!-- demais valores monetários em formato BR; observacao -->
  </nf>
  <prestador><cpfcnpj>27692077000126</cpfcnpj><cidade>8221</cidade></prestador>
  <tomador><!-- tipo, cpfcnpj, endereço TOM, e-mail, etc. --></tomador>
  <itens><lista>
    <codigo_local_prestacao_servico>8221</codigo_local_prestacao_servico>
    <codigo_atividade>4930201</codigo_atividade>
    <codigo_item_lista_servico>160201</codigo_item_lista_servico>
    <descritivo>Qtde 1,00 ...</descritivo>
    <aliquota_item_lista_servico>2,0000</aliquota_item_lista_servico>
    <situacao_tributaria>0</situacao_tributaria>
    <valor_tributavel>5.840,00</valor_tributavel>
    <tributa_municipio_prestador>S</tributa_municipio_prestador>
    <tributa_municipio_tomador>N</tributa_municipio_tomador>
  </lista></itens>
</nfse>
```

**DTOs principais:** `EmitirNfseDto` (`rps`, `servico`, `tomador`, opcionais `dataFato`, `observacao`, `identificadorArquivo`, `modoTeste`); `CancelarNfseDto` (`motivo`, `serieNfse`, `nfsEmitidaId`).

---

*Texto sintetizado para o repositório; o detalhamento normativo permanece no documento PDF original do solicitante.*
