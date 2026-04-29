import { createHash } from 'crypto';
import { isValidIso6346 } from '../common/utils/iso6346';
import { isValidPlacaMercosulExtended } from '../common/utils/mercosul';

export type OcrProviderMockId = 'GOOGLE_VISION' | 'AWS_REKOGNITION' | 'OPENCV_STUB';

export interface OcrGateExtracaoBruta {
  placaRaw?: string;
  numeroIsoRaw?: string;
  tipoContainerRaw?: string;
  fullnessRaw?: string;
  lacreRaw?: string;
}

export interface OcrGateExtracaoValidadaDto {
  placa: string | null;
  placaValidaMercosul: boolean;
  numeroIso: string | null;
  numeroIsoValido6346: boolean;
  tipoContainer: string | null;
  fullness: string | null;
  lacre: string | null;
  providerUsado: OcrProviderMockId;
  confiancaLeitura: number;
}

/** Rotaciona provider mock via hash da imagem (simula round-robin). */
export function resolverProviderMock(buffer: Buffer): OcrProviderMockId {
  const h = createHash('sha256').update(buffer).digest()[0] % 3;
  if (h === 0) return 'GOOGLE_VISION';
  if (h === 1) return 'AWS_REKOGNITION';
  return 'OPENCV_STUB';
}

/**
 * Extração simulada — não chama APIs externas.
 * Deriva texto estável a partir do digest para testes repetíveis.
 */
export function mockExtrairGate(buffer: Buffer): { provider: OcrProviderMockId; bruto: OcrGateExtracaoBruta } {
  const provider = resolverProviderMock(buffer);
  const digest = createHash('sha256').update(buffer).digest('hex');
  const n = parseInt(digest.slice(0, 8), 16);

  const placas = ['ABC1D34', 'XYZ9A12', 'TEST9X99'];
  /** Apenas códigos que passam container-validator (ISO 6346). */
  const isos = ['TEMU6079348'];

  const placaRaw = placas[n % placas.length];
  const numeroIsoRaw = isos[(n >> 4) % isos.length];

  const fullnessOpts = ['CHEIO', 'VAZIO', 'PARCIAL'];
  const tipoOpts = ['40HC', '20DV', '40DV'];

  return {
    provider,
    bruto: {
      placaRaw,
      numeroIsoRaw,
      tipoContainerRaw: tipoOpts[(n >> 8) % tipoOpts.length],
      fullnessRaw: fullnessOpts[(n >> 12) % fullnessOpts.length],
      lacreRaw: `L${(n % 900000) + 100000}`,
    },
  };
}

export function validarExtracaoOcrGate(bruto: OcrGateExtracaoBruta): OcrGateExtracaoValidadaDto {
  const placaNorm = bruto.placaRaw?.replace(/[\s-]/g, '').toUpperCase() ?? '';
  const isoNorm = bruto.numeroIsoRaw?.replace(/\s/g, '').toUpperCase() ?? '';

  const placaOk = placaNorm ? isValidPlacaMercosulExtended(placaNorm) : false;
  const isoOk = isoNorm ? isValidIso6346(isoNorm) : false;

  const providerUsado: OcrProviderMockId = 'GOOGLE_VISION';

  return {
    placa: placaOk ? placaNorm : null,
    placaValidaMercosul: placaOk,
    numeroIso: isoOk ? isoNorm : null,
    numeroIsoValido6346: isoOk,
    tipoContainer: bruto.tipoContainerRaw?.trim() ?? null,
    fullness: bruto.fullnessRaw?.trim() ?? null,
    lacre: bruto.lacreRaw?.trim() ?? null,
    providerUsado,
    confiancaLeitura: Math.round((0.72 + (placaOk ? 0.12 : 0) + (isoOk ? 0.11 : 0)) * 100) / 100,
  };
}

/** Fluxo completo mock + validação (pipeline conceitual alinhado a provider futuro). */
export function pipelineOcrGateMock(buffer: Buffer): OcrGateExtracaoValidadaDto {
  const { provider, bruto } = mockExtrairGate(buffer);
  const v = validarExtracaoOcrGate(bruto);
  return { ...v, providerUsado: provider };
}
