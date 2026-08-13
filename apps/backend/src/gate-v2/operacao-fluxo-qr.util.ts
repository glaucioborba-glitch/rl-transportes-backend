import { randomUUID } from 'crypto';
import type { OperacaoFluxoJson, OperacaoState } from './operacao-states.constants';

export function buildQrOnApproval(
  existingJson: OperacaoFluxoJson,
  protocolo: string,
  clienteId: string,
  container: string,
) {
  const validade = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const token = randomUUID();
  return {
    operacaoFluxoEstado: 'AGUARDANDO_CHEGADA' as OperacaoState,
    operacaoFluxoJson: {
      ...existingJson,
      qrToken: token,
      qrValidade: validade,
    } as OperacaoFluxoJson,
    qrToken: token,
    qrValidade: validade,
    qrPayload: Buffer.from(
      JSON.stringify({ protocolo, token, validade, clienteId, containerNumero: container }),
    ).toString('base64'),
  };
}
