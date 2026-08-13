# ADR 003 — v2 Canonical / Legacy Sunset

## Status
Proposed — 2026-07-21

## Contexto
Convivência entre `solicitacoes/` (v1), `gates`/`patios` legacy e stack v2 (`gate_v2_check_ins`, `patio_v2_unidades`, portal corporativo).

## Decisão
**Canonical = v2** a partir de T1 (semana 2 pós go-live staging).

| Fase | Data alvo | Ação |
|------|-----------|------|
| T0 | Go-live staging | Documentar matriz rota→stack |
| T1 | +2 sem | Novas solicitações só portal v2 |
| T2 | +4 sem | Operador UI só gate-v2/patio-v2 |
| T3 | +6 sem | MVs Datahub só origem V2 |
| T4 | +8 sem | Remover writes legacy |

## Feature flag
`LEGACY_GATE_WRITE=0` (default prod) — bloqueia novos registros em `gates`/`patios` legacy.

## Consequências
- Menos UNION ALL em MVs
- E2E gate-v2 como suite principal
- v1 read-only até T4
