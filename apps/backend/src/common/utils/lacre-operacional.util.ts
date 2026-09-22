/**
 * Fonte única do lacre operacional.
 *
 * Unidade no pátio / coleta / exportação: lacre atual da caixa. Se houve
 * SUBSTITUIR_LACRE_SAIDA (“Trocar lacre na RIC de saída”), esse número vale
 * — é o que está no equipamento e o que a coleta deve declarar.
 *
 * RIC de entrada: snapshot do gate-in (`containers_solicitacao.lacre`).
 * RIC de saída: lacre atual (`unidade_processos.lacre_saida` ou o da entrada).
 */
export type DirecaoRicLacre = 'ENTRADA' | 'SAIDA';

export function normalizeLacreOperacional(value?: string | null): string | null {
  const t = value?.trim();
  return t ? t : null;
}

export function lacreRic(
  direcao: DirecaoRicLacre,
  lacreEntrada?: string | null,
  lacreSaida?: string | null,
): string | null {
  const entrada = normalizeLacreOperacional(lacreEntrada);
  const saida = normalizeLacreOperacional(lacreSaida);
  if (direcao === 'SAIDA') return saida || entrada;
  return entrada;
}

export type LacreTrocaPatio = {
  atual: string;
  anterior: string;
  observacao: string;
  origem: string;
};

export function rotuloOrigemLacre(origem?: string | null): string {
  const v = String(origem ?? '').trim().toUpperCase();
  if (v === 'CLIENTE') return 'cliente';
  if (v === 'TERMINAL') return 'empresa';
  if (v === 'PROVISORIO') return 'provisório';
  return '';
}

/** Troca lançada no pátio — só existe quando o número atual ≠ o da RIC de entrada. */
export function lacreTrocaPatio(params: {
  lacreEntrada?: string | null;
  lacreSaida?: string | null;
  observacao?: string | null;
  origem?: string | null;
}): LacreTrocaPatio | null {
  const atual = normalizeLacreOperacional(params.lacreSaida);
  const anterior = normalizeLacreOperacional(params.lacreEntrada);
  if (!atual || !anterior) return null;
  if (atual.toUpperCase() === anterior.toUpperCase()) return null;
  return {
    atual,
    anterior,
    observacao: params.observacao?.trim() || '',
    origem: params.origem?.trim() || '',
  };
}

export function textoLacreTroca(troca: LacreTrocaPatio): string {
  const partes = [`Lacre atual ${troca.atual} (entrada ${troca.anterior})`];
  if (troca.observacao) partes.push(troca.observacao.replace(/\.$/, ''));
  const origem = rotuloOrigemLacre(troca.origem);
  if (origem) partes.push(`origem ${origem}`);
  return `${partes.join(' — ')}.`;
}
