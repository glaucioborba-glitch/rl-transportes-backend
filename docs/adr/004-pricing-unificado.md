# ADR 004 — Pricing unificado (Cadastro ADM → Billing Engine)



## Status

**Accepted** — 2026-07-29 (atualizado com regras de handling, capacidade HC/DC, faixas diária)



## Contexto



O terminal configura preços no menu ADM:



- **Tabela padrão** + **tabelas comerciais** (ativo/inativo; editáveis).

- Matriz **Tipo × Capacidade × Tamanho × Status**:

  - **Handling** — valor **único** cobrindo gate-in e gate-out.

  - **Free time** — dias gratuitos por célula.

- **Armazenagem** — **diária escalonada por faixas de permanência** (não valor fixo por dia único).



Exemplo: free time 7 dias; dias 8–15 → R$ 30/dia; dia 16+ → R$ 45/dia. Estadia 18 dias → 8×30 + 3×45 = R$ 375.



## Decisão



### Dimensões do contêiner (MDM)



| Dimensão | Significado | Exemplos |

|----------|-------------|----------|

| **Tipo** | Material / família | DRY (latão), REEFER, OT |

| **Capacidade** | Variante de cubagem/altura | HC (High Cube), DC (Dry Container padrão) |

| **Tamanho** | Comprimento ISO | 20′, 40′, 45′ |

| **Status** | Cheio ou vazio | CHEIO, VAZIO |



HC/DC **não** são tipos separados — são **capacidade** vinculada ao tipo DRY (e outros quando aplicável).



### Handling



- Um campo `valorHandling` por célula da matriz.

- Cobrança **uma vez por ciclo** (entrada + saída inclusas).

- Runtime: evento tarifário `HANDLING` no fechamento (gate-out) **ou** `GATE_IN` com valor integral e `GATE_OUT` = 0.



### Armazenagem — faixas diária



- Entidade **`CadastroTabelaPrecoFaixaDiaria`** (ou JSONB validado) por tabela.

- Campos: `diaInicio`, `diaFim` (null = sem limite), `valorDiaria`.

- Contagem de dias: **corridos** (PR-02); free time consome os primeiros N dias.

- Billing engine: `FaixaDiariaCalculator` substitui multiplicação simples `diasFaturaveis × valor`.



### Tabela padrão e cliente



- Flag `padrao` — uma tabela padrão ativa por tenant.

- `cliente.tabelaPrecoId` — null = usa padrão.

- Sync cadastro → `TabelaPreco` + regras/faixas JSON.



### Vigência



- **Ativo/inativo** suficiente; sem obrigatoriedade de data início/fim.



### Legado



- `TabelaTarifaria` descontinuada após migração.



## Modelo de sync (resumo)



| Cadastro | Billing runtime |

|----------|-----------------|

| `valorHandling` | 1× HANDLING (ou GATE_IN único) |

| `freeTimeDias` | parâmetro do calculator + metadata regra |

| Faixas diária | JSONB `faixasDiaria` na tabela/regra ou tabela filha sync |

| tipo + capacidade + tamanho + status | chave matching contêiner |



## Consequências



- UI ADM: matriz + editor de faixas (step table).

- Testes obrigatórios: caso 7 free + 18 dias; handling single charge.

- Fase 2 opcional: faixas diferentes por célula da matriz (negociações extremas).



## Implementação



[ROADMAP.md](../programa-melhorias/ROADMAP.md) — Workstreams A.1–A.6.

