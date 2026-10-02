/** Fuso civil da operação. Sem isso o Docker (UTC) imprime a RIC 3 h à frente. */
process.env.TZ ??= 'America/Sao_Paulo';
