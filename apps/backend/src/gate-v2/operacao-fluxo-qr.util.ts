import { randomUUID } from 'crypto';
import type { OperacaoFluxoJson, OperacaoState } from './operacao-states.constants';

export const QR_VALIDADE_HORAS_PADRAO = 24;
export const QR_VALIDADE_HORAS_MIN = 1;
export const QR_VALIDADE_HORAS_MAX = 168;

export type QrUnificadoPayload = {
  protocolo: string;
  token: string;
};

export function clampQrValidadeHoras(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return QR_VALIDADE_HORAS_PADRAO;
  return Math.min(QR_VALIDADE_HORAS_MAX, Math.max(QR_VALIDADE_HORAS_MIN, Math.round(n)));
}

export function qrTokenFromFluxo(json: OperacaoFluxoJson | null | undefined): string | null {
  const t = json?.qrToken?.trim();
  return t ? t : null;
}

export function buildQrUnificadoPayload(protocolo: string, token: string): QrUnificadoPayload {
  return { protocolo, token };
}

export function serializeQrUnificado(protocolo: string, token: string): string {
  return JSON.stringify(buildQrUnificadoPayload(protocolo, token));
}

export function issueQrInactive(existing?: OperacaoFluxoJson | null): OperacaoFluxoJson {
  const token = qrTokenFromFluxo(existing) ?? randomUUID();
  return {
    ...(existing ?? {}),
    qrToken: token,
    qrAtivo: false,
    qrValidade: undefined,
  };
}

export function activateQr(
  existing: OperacaoFluxoJson | null | undefined,
  validadeHoras: number,
): { operacaoFluxoEstado: OperacaoState; operacaoFluxoJson: OperacaoFluxoJson } {
  const hours = clampQrValidadeHoras(validadeHoras);
  const token = qrTokenFromFluxo(existing) ?? randomUUID();
  const validade = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  return {
    operacaoFluxoEstado: 'AGUARDANDO_CHEGADA',
    operacaoFluxoJson: {
      ...(existing ?? {}),
      qrToken: token,
      qrAtivo: true,
      qrValidade: validade,
    },
  };
}

export function deactivateQr(existing: OperacaoFluxoJson | null | undefined): OperacaoFluxoJson {
  const token = qrTokenFromFluxo(existing) ?? randomUUID();
  return {
    ...(existing ?? {}),
    qrToken: token,
    qrAtivo: false,
  };
}

export function qrEstaAtivo(json: OperacaoFluxoJson | null | undefined, agora = new Date()): boolean {
  if (!json?.qrToken) return false;
  if (json.qrAtivo === false) return false;
  if (json.qrValidade && new Date(json.qrValidade) <= agora) return false;
  if (json.qrAtivo === true) return true;
  // registros antigos: validade no futuro conta como ativo
  return Boolean(json.qrValidade && new Date(json.qrValidade) > agora);
}

/** Gera/reativa o QR na aprovação — reutiliza o token se já existir. */
export function buildQrOnApproval(
  existingJson: OperacaoFluxoJson,
  protocolo: string,
  clienteId: string,
  container: string,
  validadeHoras: number = QR_VALIDADE_HORAS_PADRAO,
) {
  const activated = activateQr(existingJson, validadeHoras);
  const token = activated.operacaoFluxoJson.qrToken!;
  const validade = activated.operacaoFluxoJson.qrValidade!;
  return {
    operacaoFluxoEstado: activated.operacaoFluxoEstado,
    operacaoFluxoJson: activated.operacaoFluxoJson,
    qrToken: token,
    qrValidade: validade,
    qrPayload: serializeQrUnificado(protocolo, token),
    clienteId,
    containerNumero: container,
  };
}
