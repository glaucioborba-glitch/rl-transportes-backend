export type OrigemNotificacaoUnidade = 'PORTAL' | 'GATE';

export type GateNotificacaoCampo = {
  campo: string;
  label: string;
  antes: string;
  depois: string;
};

export const LABEL_PATCH_CONTAINER: Record<string, string> = {
  unidade: 'Unidade',
  tipo: 'Tipo',
  tamanho: 'Tamanho',
  status: 'Situação',
  navio: 'Navio',
  processo: 'Processo',
  booking: 'Booking',
  lacre: 'Lacre',
};

export const LABEL_PATCH_TRANSPORTE: Record<string, string> = {
  placaCavalo: 'Placa cavalo',
  placaCarreta01: 'Placa carreta',
  placaCarreta02: 'Placa carreta 02',
  tipoCaminhao: 'Tipo caminhão',
  nomeMotorista: 'Motorista',
  cpfMotorista: 'CPF',
};

function textoCampo(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export function deltasDePatch(
  patch: Record<string, unknown>,
  atual: Record<string, unknown> | null | undefined,
  labels: Record<string, string>,
): GateNotificacaoCampo[] {
  const out: GateNotificacaoCampo[] = [];
  for (const [key, raw] of Object.entries(patch)) {
    if (raw === undefined) continue;
    const depois = textoCampo(raw);
    const antes = textoCampo(atual?.[key]);
    if (antes === depois) continue;
    out.push({
      campo: key,
      label: labels[key] ?? key,
      antes,
      depois,
    });
  }
  return out;
}

export function tituloNotificacaoUnidade(
  numero: number,
  campos: GateNotificacaoCampo[],
): string {
  if (campos.length === 1) {
    return `${campos[0].label} alterado no ID ${numero}`;
  }
  return `Alteração no ID ${numero}`;
}

export function corpoNotificacaoUnidade(
  unidadeIso: string,
  origem: OrigemNotificacaoUnidade,
  atorNome: string,
  campos: GateNotificacaoCampo[],
): string {
  const origemTxt = origem === 'PORTAL' ? 'pelo portal do cliente' : 'no Gate';
  const linhas = campos.map((c) => `${c.label}: ${c.antes || '—'} → ${c.depois || '—'}`);
  return `${atorNome} alterou ${unidadeIso} ${origemTxt}.\n${linhas.join('\n')}`.slice(0, 2000);
}

export function hrefConsultaRicUnidade(unidadeIso: string): string {
  return `/operador/gate/consulta-ric?q=${encodeURIComponent(unidadeIso)}`;
}
