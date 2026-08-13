-- Seed parâmetros operacionais/financeiros no tenant default (JSONB merge)
UPDATE "tenant_configs"
SET "parametros" = COALESCE("parametros", '{}'::jsonb) || '{
  "operacional": {
    "capacidadeTotalSlots": 280,
    "horarioFuncionamentoInicio": "06:00",
    "horarioFuncionamentoFim": "22:00",
    "freeTimePadraoDias": 7,
    "tatAlvoBaixaHoras": 2,
    "tatAlvoColetaHoras": 2,
    "tatAlvoTransferenciaHoras": 1,
    "limiteAgendamentosPorTurno": 15,
    "operacaoFimSemana": false,
    "tempoToleranciaChegadaMin": 30
  },
  "financeiro": {
    "diasToleranciaBloqueioPadrao": 3,
    "percentualMultaAtrasoPadrao": 2.0,
    "percentualJurosAoMesPadrao": 1.0,
    "condicaoPagamentoDefault": "FATURAMENTO",
    "tabelaPrecoAtivaId": null,
    "emiteNfseAutomatico": true,
    "emiteBoletoAutomatico": true,
    "diasVencimentoBoletoPadrao": 7
  }
}'::jsonb
WHERE "tenant_id" = 'default';
