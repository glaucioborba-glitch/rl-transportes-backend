import { PatioStatus, StatusContainerTarifa } from '@prisma/client';
import { rotuloOrigemLacre } from '../common/utils/lacre-operacional.util';
import { isValidIso6346 } from '../common/utils/iso6346';

/** Unidade fisicamente na empresa (pátio). Não existe status “já saiu” — o registro some no gate-out. */
export const PATIO_STATUS_ARMAZENADA: PatioStatus[] = [
  PatioStatus.ESTOCADO,
  PatioStatus.SEPARADO,
  PatioStatus.MOVIMENTANDO,
  PatioStatus.AGUARDANDO_GATE_OUT,
];

export function patioContaComoArmazenada(status: PatioStatus | null | undefined): boolean {
  if (!status) return false;
  return PATIO_STATUS_ARMAZENADA.includes(status);
}

export const SERVICO_EFEITOS = ['NENHUM', 'SUBSTITUIR_LACRE_SAIDA', 'TRANSBORDO_CARGA'] as const;
export type ServicoEfeitoTipo = (typeof SERVICO_EFEITOS)[number];

export const ORIGENS_LACRE = ['CLIENTE', 'TERMINAL', 'PROVISORIO'] as const;
export type OrigemLacre = (typeof ORIGENS_LACRE)[number];

export type ServicoEfeitoConfig = {
  servicoLacreTerminalCodigo?: string;
  observacaoRic?: string;
};

export type LancarServicoEfeitoInput = {
  lacre?: string;
  origemLacre?: string;
  isoDestino?: string;
};

export type ServicoEfeitoPayload = {
  efeito: ServicoEfeitoTipo;
  lacre?: string;
  origemLacre?: OrigemLacre;
  isoDestino?: string;
  unidadeProcessoDestinoId?: string;
  observacaoRic?: string;
  vinculado?: boolean;
};

export function parseServicoEfeito(raw: unknown): ServicoEfeitoTipo {
  const v = String(raw ?? 'NENHUM').trim().toUpperCase();
  return (SERVICO_EFEITOS as readonly string[]).includes(v) ? (v as ServicoEfeitoTipo) : 'NENHUM';
}

export function parseEfeitoConfig(raw: unknown): ServicoEfeitoConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const codigo = typeof o.servicoLacreTerminalCodigo === 'string' ? o.servicoLacreTerminalCodigo.trim().toUpperCase() : '';
  const observacaoRic = typeof o.observacaoRic === 'string' ? o.observacaoRic.trim() : '';
  return {
    ...(codigo ? { servicoLacreTerminalCodigo: codigo } : {}),
    ...(observacaoRic ? { observacaoRic } : {}),
  };
}

export function parseOrigemLacre(raw: unknown): OrigemLacre | null {
  const v = String(raw ?? '').trim().toUpperCase();
  return (ORIGENS_LACRE as readonly string[]).includes(v) ? (v as OrigemLacre) : null;
}

export function statusParaHandling(
  status: StatusContainerTarifa | null | undefined,
  faturarHandlingComoCheio?: boolean,
): StatusContainerTarifa | null {
  if (faturarHandlingComoCheio) return StatusContainerTarifa.CHEIO;
  if (!status || status === StatusContainerTarifa.AMBOS) return null;
  return status;
}

export function observacaoLacreRic(nomeServico: string, config: ServicoEfeitoConfig): string {
  if (config.observacaoRic) return config.observacaoRic;
  return `Número do lacre alterado por ${nomeServico.trim() || 'serviço adicional'}.`;
}

const OBSERVACAO_GATE_MAX = 2000;
const OBSERVACAO_LACRE_SAIDA_MAX = 255;

export function appendObservacao(atual: string | null | undefined, linha: string, max = OBSERVACAO_GATE_MAX): string {
  const linhaT = linha.trim();
  const prev = atual?.trim() || '';
  if (!linhaT) return prev;
  if (prev.includes(linhaT)) return prev;
  const next = prev ? `${prev} · ${linhaT}` : linhaT;
  return next.length <= max ? next : next.slice(0, max);
}

export function linhaObservacaoTrocaLacre(params: {
  servico: string;
  anterior?: string | null;
  atual: string;
  origem?: string | null;
}): string {
  const servico = params.servico.trim() || 'serviço adicional';
  const de = params.anterior?.trim() || '—';
  const para = params.atual.trim() || '—';
  const origem = rotuloOrigemLacre(params.origem);
  const origemTxt = origem ? ` (origem ${origem})` : '';
  return `${servico}: lacre ${de} → ${para}${origemTxt}.`;
}

export function linhaObservacaoTransbordo(params: {
  servico: string;
  isoOrigem: string;
  isoDestino: string;
  papel: 'ORIGEM' | 'DESTINO';
  statusAntes: string;
  statusDepois: string;
  lacre?: string | null;
}): string {
  const servico = params.servico.trim() || 'Transbordo';
  const a = params.isoOrigem.trim() || '—';
  const b = params.isoDestino.trim() || '—';
  const lacre = params.lacre?.trim();
  if (params.papel === 'ORIGEM') {
    return `${servico}: transbordo de ${a} (${params.statusAntes} → ${params.statusDepois}) para ${b}.`;
  }
  return `${servico}: transbordo de ${a} para ${b} (${params.statusAntes} → ${params.statusDepois})${lacre ? `; lacre ${lacre}` : ''}.`;
}

export function recortarObservacaoLacreSaida(linha: string): string {
  return appendObservacao('', linha, OBSERVACAO_LACRE_SAIDA_MAX);
}

export function linhasObservacaoEfeito(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x ?? '').trim()).filter(Boolean);
}

export function appendLinhaObservacaoEfeito(lista: unknown, linha: string): string[] {
  const prev = linhasObservacaoEfeito(lista);
  const linhaT = linha.trim();
  if (!linhaT) return prev;
  if (prev.some((p) => p === linhaT)) return prev;
  return [...prev, linhaT];
}

export function pareceLinhaEfeitoServico(texto: string): boolean {
  const t = texto.trim();
  if (!t) return false;
  if (/^Desfeito:/i.test(t)) return true;
  if (/: lacre .+ → /.test(t)) return true;
  if (/: transbordo de /i.test(t)) return true;
  return false;
}

function partesObservacao(livre: string): string[] {
  return livre
    .split(/\s*·\s*|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Separa texto livre do operador das linhas geradas por serviço (não mistura os dois). */
export function separarObservacaoLivreEEfeitos(
  livreRaw: unknown,
  efeitosRaw: unknown,
): { livre: string; efeitos: string[] } {
  const efeitos = [...linhasObservacaoEfeito(efeitosRaw)];
  const livreStr = typeof livreRaw === 'string' ? livreRaw.trim() : '';
  if (!livreStr) return { livre: '', efeitos };
  const kept: string[] = [];
  for (const parte of partesObservacao(livreStr)) {
    if (efeitos.includes(parte) || pareceLinhaEfeitoServico(parte)) {
      if (!efeitos.includes(parte)) efeitos.push(parte);
      continue;
    }
    kept.push(parte);
  }
  return { livre: kept.join(' · '), efeitos };
}

/** Junta observação livre + lançamentos de serviço, sem apagar nem duplicar. */
export function composeObservacao(
  livre?: string | null,
  efeitos?: string[] | null,
  extra?: string | null,
): string {
  const out: string[] = [];
  for (const p of [livre, ...(efeitos ?? []), extra]) {
    const t = p?.trim() || '';
    if (!t) continue;
    if (out.some((x) => x === t || x.includes(t))) continue;
    out.push(t);
  }
  return out.join(' · ');
}

export function validarCamposEfeito(
  efeito: ServicoEfeitoTipo,
  input: LancarServicoEfeitoInput,
  config: ServicoEfeitoConfig,
): { ok: true } | { ok: false; erro: string } {
  if (efeito === 'NENHUM') return { ok: true };

  if (efeito === 'SUBSTITUIR_LACRE_SAIDA') {
    const lacre = String(input.lacre ?? '').trim();
    if (!lacre) return { ok: false, erro: 'Informe o número do novo lacre.' };
    const origem = parseOrigemLacre(input.origemLacre);
    if (!origem) {
      return { ok: false, erro: 'Informe a origem do lacre: cliente, empresa ou provisório.' };
    }
    if (origem === 'TERMINAL' && !config.servicoLacreTerminalCodigo) {
      return {
        ok: false,
        erro: 'Este serviço exige um item de lacre da empresa no cadastro (quando o lacre é retirado pela RL).',
      };
    }
    return { ok: true };
  }

  const iso = String(input.isoDestino ?? '').replace(/[^a-zA-Z0-9]/g, '');
  if (iso.length < 10) {
    return { ok: false, erro: 'Informe o ISO da unidade de destino (B) para o transbordo.' };
  }
  if (!isValidIso6346(iso)) {
    return { ok: false, erro: 'Número ISO inválido (dígito verificador ISO 6346).' };
  }
  return { ok: true };
}
