# Dashboard Financeiro Executivo — RL Transportes  
## Layout visual conceitual (UI/UX / Frontend / BI)

Documento de referência para implementação em **React / Next / Angular**, embutimento em **Metabase / Power BI / Apache Superset**, ou prototipagem em Figma.  
**Não inclui código de implementação** — apenas estrutura, hierarquia, componentes e mapeamento de dados.

---

## 1. Estrutura de navegação (UX)

Navegação principal por **âncoras na mesma página** (dashboard único) ou **abas secundárias** no topo, mantendo filtro global de período (`periodoInicio` / `periodoFim`) e opcionalmente `clienteId` sempre visíveis na barra de contexto.

| Âncora / aba            | Conteúdo resumido |
|-------------------------|-------------------|
| **Receita**             | KPIs de receita, linha 12 meses, TOP 10 clientes, donut concluído vs pendente |
| **Inadimplência**       | Taxa geral, ranking por cliente, métricas de boletos vencidos/pendentes |
| **Contas a Receber**    | Aging empilhado, tabelas de boletos, valor por faixa |
| **Curva ABC**           | Pareto + tabela classificada A/B/C |
| **Clientes Corporate**  | PJ vs PF, participação, visão filtrada por cliente (quando aplicável) |
| **Forecast / Projeções**| Área com forecast de faturamento e de inadimplência |
| **Performance operacional por receita** | KPI receita/unidade (proxy margem), vínculo solicitações ↔ faturamento (detalhe) |

**Comportamento sugerido:** ao alterar período ou cliente, **scroll suave** para a seção “Foto do Período” e atualização global (um único `GET /dashboard-financeiro`).

---

## 2. Layout visual — Cards superiores (KPIs de impacto)

### 2.1 Grid de cards

- **Desktop:** grade **3×3** (9 cards); linha extra opcional para 8º–9º KPI se necessário.
- Cada card: **altura mínima uniforme**, padding generoso, número principal em **tipo grande** (ex.: 28–36px), subtítulo e variação em texto menor.

### 2.2 Lista de cards e regras visuais

| Card | Fonte de dados (API) | Variação MoM | Cor condicional | Tooltip executivo (exemplo) |
|------|-------------------------|--------------|-----------------|----------------------------|
| **Receita total no período** | `snapshot.faturamentoTotalPeriodo` | `snapshot.variacaoMesAMesPercent` (vs mês anterior do *fim* do intervalo) | Verde se MoM ≥ 0; amarelo leve se entre −5% e 0; vermelho se &lt; −5% | “Soma dos `valorTotal` dos faturamentos no intervalo de competência selecionado.” |
| **Receita faturada** | Igual ao total no período *ou* derivar da série somando `faturado` no mesmo recorte | Opcional: MoM da série agregada | Mesma lógica | “Volume faturado no período (competência).” |
| **Receita recebida** | Somar `recebido` em `series` apenas nos meses ∈ período **ou** estimativa via boletos `PAGO` (BI) | MoM da mesma métrica | Verde predominante (entrada de caixa) | “Valores efetivamente reconhecidos como pagos no recorte analisado.” |
| **Receita pendente** | Donut `receita.donut.pendente` ou somar `pendente` na série no período | Evolução vs mês anterior | Amarelo / laranja | “Posição ainda não liquidada (em aberto operacional).” |
| **Boletos vencidos** | `inadimplencia.boletosVencidos` + destaque em **valor** (`valorVencidoTotal`) | Δ vs período anterior (requer histórico ou segunda chamada) | Vermelho se &gt; 0 e taxa alta | “Quantidade e montante em atraso formal (status VENCIDO).” |
| **Aging crítico (&gt;90 dias)** | Somar `aging` onde `faixa === '91+'` (e eventualmente consolidar com política interna) | Tendência | Vermelho intenso | “Exposição de risco de caixa nas faixas mais antigas.” |
| **Ticket médio por OS** | `snapshot.mediaTicketPorSolicitacao` | Opcional: comparar com período anterior | Neutro ou verde se meta interna atingida | “Faturamento ÷ solicitações distintas vinculadas aos faturamentos.” |
| **Receita por container** | `rentabilidade.faturamentoPorContainer` (ou `proxyMargemOperacional`) | MoM opcional | Verde / amarelo conforme meta logística | “Indicador clássico de terminal: receita por unidade operacional vinculada.” |

**Observação:** “Receita faturada” vs “Receita total” podem coincidir no modelo atual; no BI, diferenciar apenas se houver regra contábil extra (fora do escopo deste doc).

### 2.3 Elementos obrigatórios por card

- **Número grande** — formatação monetária (BRL) ou inteiro para contagens.
- **Variação mês anterior** — texto tipo `+12,7% MoM` ou `−3,2% MoM`, com seta ↑↓ discreta.
- **Cor condicional** — borda esquerda 4px ou badge pill no canto (verde / âmbar / vermelho).
- **Tooltip** — ícone “i”; conteúdo em 1–2 frases executivas (tabela acima).

---

## 3. Gráficos recomendados

### A) Receita por mês (12 meses)

- **Tipo:** Line chart (duas séries).
- **Dados:** `series[]` → eixo X `mes`, séries `faturado` e `recebido`.
- **UX:** legenda clara; destaque do último ponto; opcional área sombreada leve sob “recebido”.

### B) Distribuição do faturamento por cliente

- **Tipo:** Horizontal bar chart.
- **Dados:** `receita.faturamentoPorClienteTop10` — ordenação decrescente por `valorTotal`.
- **UX:** rótulos com nome truncado + tooltip com valor e `%` (`participacaoPercent`).

### C) Curva ABC de faturamento

- **Tipo:** Pareto (barras por cliente + linha cumulativa %).
- **Dados:** `clientes.curvaAbc` — `valor`, `percentualAcumulado`, `classe` (`A`/`B`/`C`).
- **Regra visual:** cores por classe (A azul escuro, B cinza-azulado, C cinza claro); linha cumulativa em verde ou âmbar.

### D) Inadimplência (Aging)

- **Tipo:** Stacked bar **horizontal** ou vertical único empilhado por valor.
- **Dados:** `aging[]` — faixas `a_vencer`, `0-30`, `31-60`, `61-90`, `91+` (excluir `nao_aplica` do layout).
- **UX:** escala de cor da mais clara (a vencer) à mais escura (&gt;90).

### E) Projeção futura (Forecast)

- **Tipo:** Area chart suavizado (ou linha + área translúcida).
- **Séries:** histórico `series[].faturado` (últimos N meses) + **ponto/projeto** para próximo período usando `inadimplencia.forecastFaturamentoProximoMes`; segunda série opcional para taxa com `forecastInadimplenciaPercent`.
- **UX:** linha tracejada para “projetado”; disclaimer fixo: “Projeção baseada em média móvel / modelo interno — não é garantia.”

### F) Fluxo caixa (Receita × Vencimento)

- **Tipo:** Heatmap semanal.
- **Dados:** **não expostos literalmente** na API atual como matriz semanal — construir no **ETL/BI** a partir de boletos (`dataVencimento`, `valorBoleto`, `statusPagamento`) ou exportação.
- **UX:** eixo Y semanas ISO, eixo X dias ou categorias; intensidade = valor.

---

## 4. Tabelas financeiras essenciais

Layout tabular com **toolbar** comum: ordenação por coluna, busca textual, filtros de status e chips de período herdados do topo.

| Tabela | Origem principal | Colunas sugeridas | UX |
|--------|------------------|-------------------|-----|
| **Boletos pendentes** | Endpoint dedicado futuro **ou** lista derivada do backend de boletos | Nº boleto, cliente, valor, vencimento, dias até/atraso, status | Badge âmbar “Pendente” |
| **Boletos vencidos** | Idem | Mesmas + dias em atraso | Badge vermelho; ordenação default por maior atraso |
| **Ranking inadimplência** | `inadimplencia.inadimplenciaPorCliente` | Cliente, qtd boletos vencidos, valor | Barra inline de severidade |
| **Detalhamento por período** | `series` + drill-down para faturamentos | Mês, faturado, recebido, pendente, vencido | Linha expansível para documentos/notas se integrado |

**Badges de criticidade:**  
- Verde: em dia ou &lt; 30 dias  
- Amarelo: 31–60  
- Vermelho: &gt; 60 ou status VENCIDO  

---

## 5. Hierarquia gerencial (UX de decisão)

### Seção 1 — “Foto do período”

- Barra de filtros (período, cliente).
- **Grid 3×3 de KPIs** (Seção 2 deste doc).
- Linha única de **donut** ou mini-cards **Concluído vs Pendente** (`receita.donut` / `snapshot.faturamentoConcluidoVsPendente`).

### Seção 2 — “Saúde financeira”

- Gráfico **D** (Aging stacked).
- KPIs de **taxa de inadimplência** (`taxaInadimplenciaGeralPercent`) e **valor vencido**.
- Tabelas resumidas de boletos (Seção 4).

### Seção 3 — “Clientes & Curva ABC”

- Gráfico **B** (horizontal bar TOP 10).
- Gráfico **C** (Pareto ABC).
- Bloco **Corporate**: cards lado a lado `receitaPj`, `receitaPf`, `percentualParticipacaoPj`.

### Seção 4 — “Tendências & forecast”

- Gráfico **A** (linha 12 meses).
- Gráfico **E** (área forecast).
- Texto curto com **forecast de inadimplência** e **próximo mês faturamento**.

### Seção 5 — “Detalhamento operacional com impacto financeiro”

- KPI **receita por container** + **unidades consideradas** (`rentabilidade`).
- Texto explicativo: vínculo entre solicitações concluídas operacionalmente e linhas de faturamento (integração conceitual; dados detalhados podem vir de relatórios ou segunda API).

**Fluxo de decisão sugerido:** período → foto → saúde (aging) → clientes de risco (ABC + ranking) → tendência → ações (drill para boletos/cliente).

---

## 6. Layout responsivo

| Breakpoint | Comportamento |
|------------|----------------|
| **Desktop** (≥1280px) | Grid KPI **3×3**; gráficos dois por linha onde couber; tabelas largura total |
| **Tablet** (768–1279px) | KPI **2 colunas** (grid 2×N); gráficos empilhados 1 coluna |
| **Mobile** (&lt;768px) | KPI **1 coluna**; scroll vertical único; gráficos altura reduzida + legenda abaixo |
| **Leitura executiva** | Primeira dobra = filtros + 4–6 KPIs principais + 1 gráfico-chave (linha ou aging) |

---

## 7. Sugestões de UI/UX

- **Paleta:** fundo cinza muito claro (`#F5F7FA`); cards brancos; **azul escuro** (`#1E3A5F`) para títulos e primário; **verde** (`#2E7D32`) recebimento/metas; **âmbar** alertas; **vermelho** risco.
- **Cards:** sombra `0 2px 8px rgba(0,0,0,.08)`; **border-radius 6px**; padding 16–20px.
- **Ícones:** linha fina (Lucide / Heroicons): moeda (receita), arquivo (boleto), triângulo alerta (risco), linha tendência (forecast).
- **Loading:** **skeleton** em cards e barras de gráfico antes da resposta JSON.
- **Acessibilidade:** contraste WCAG AA nos textos; valores monetários com `aria-label` falados por leitor de tela.

---

## 8. Protótipo textual (wireframe)

```
┌─────────────────────────────────────────────────────────────────┐
│ [ Logo ]  Dashboard Financeiro     [ Período ▾ ] [ Cliente ▾ ] │
├─────────────────────────────────────────────────────────────────┤
│ SEÇÃO 1 — Foto do período                                       │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│ │ KPI1 │ │ KPI2 │ │ KPI3 │ │ KPI4 │ │ KPI5 │ │ KPI6 │ │ KPI7 │… │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘   │
│ [ Donut Concluído vs Pendente ]                                   │
├─────────────────────────────────────────────────────────────────┤
│ SEÇÃO 2 — Saúde financeira    [ Aging stacked ] [ Taxa inad. ]   │
│ [ Tabela ranking inadimplência ] [ Mini boletos ]               │
├─────────────────────────────────────────────────────────────────┤
│ SEÇÃO 3 — Clientes & ABC    [ Barras TOP10 ] [ Pareto ABC ]      │
│ [ PJ vs PF cards ]                                              │
├─────────────────────────────────────────────────────────────────┤
│ SEÇÃO 4 — Tendências        [ Linha 12m ] [ Área Forecast ]      │
├─────────────────────────────────────────────────────────────────┤
│ SEÇÃO 5 — Operacional       [ Receita/container ] [ Detalhe ]    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Observações técnicas para frontend / BI

1. **Contrato principal:** `GET /dashboard-financeiro` (JWT **ADMIN** ou **GERENTE**, permissão `dashboard:financeiro_executivo`). Montar um **único fetch** por mudança de filtro e distribuir props às seções.
2. **Duplicação donut:** `receita.donut` e `snapshot.faturamentoConcluidoVsPendente` são equivalentes funcionalmente — exibir **uma vez** na UI ou usar só snapshot na “foto do período”.
3. **MoM:** já vem em `snapshot.variacaoMesAMesPercent` (comparação do último mês do intervalo com o anterior); demais KPIs podem precisar de **segunda consulta** ou cache no cliente para MoM em todos os cards.
4. **Heatmap semanal (F):** exige preparação no BI ou endpoint adicional agregando boletos por semana — não está no JSON atual.
5. **Metabase / Power BI / Superset:** usar este doc como **especificação de workbook**: mesmas seções, mesmos tipos de gráfico; conectar à mesma base PostgreSQL ou a uma **view materializada** espelhando as agregações do serviço.
6. **Performance:** evitar re-render pesado — memoizar séries; virtualizar tabelas longas.

---

## 10. Checklist de entrega UI

- [ ] Filtros globais persistentes (URL query opcional: `?periodoInicio=&periodoFim=&clienteId=`)
- [ ] 8 KPIs com MoM onde aplicável + tooltips
- [ ] 6 tipos de gráfico mapeados (A–F), com fallback se série vazia
- [ ] Tabelas com ordenação e badges
- [ ] Responsivo (3 / 2 / 1 colunas)
- [ ] Skeleton loading e estado vazio (“Sem dados no período”)

---

*Documento gerado para alinhamento entre produto, UX e engenharia; ajustar nomenclaturas com o branding oficial RL Transportes quando disponível.*
