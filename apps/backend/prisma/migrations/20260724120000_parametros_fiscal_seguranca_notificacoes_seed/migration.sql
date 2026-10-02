-- Seed parâmetros fiscal, segurança e notificações no tenant default (JSONB merge)
UPDATE "tenant_configs"
SET "parametros" = COALESCE("parametros", '{}'::jsonb) || '{
  "fiscal": {
    "municipioIbge": "4211306",
    "provedor": "IPM",
    "regimeTributario": "SIMPLES_NACIONAL",
    "aliquotaIssPadrao": 2,
    "certificadoStatus": "AUSENTE"
  },
  "seguranca": {
    "tentativasLoginAntesBloqueio": 5,
    "duracaoBloqueioMin": 15,
    "sessoesMaximasConcorrentes": 10,
    "ttlSessaoHoras": 168,
    "senhaMinLength": 8,
    "senhaExigirMaiuscula": true,
    "senhaExigirNumero": true,
    "senhaExigirEspecial": true,
    "senhaBloquearSequencias": true,
    "validarDominioCorporativo": true
  },
  "notificacoes": {
    "emailsAlerta": [],
    "webhookSlackEnabled": false,
    "debounceAlertasMin": 15,
    "templatesWhatsApp": []
  }
}'::jsonb
WHERE "tenant_id" = 'default';
