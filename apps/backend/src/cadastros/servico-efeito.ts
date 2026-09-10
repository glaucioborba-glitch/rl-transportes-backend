import { PatioStatus, StatusContainerTarifa } from '@prisma/client';

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
  return { ok: true };
}
