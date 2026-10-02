import { MotoristaGpsOrigem } from '@prisma/client';
import { onlyDigits } from '../common/utils/br-documents';

export const MOTORISTA_GPS_JWT_TYP = 'mgps';
export const MOTORISTA_GPS_ONLINE_MS = 2 * 60 * 1000;

export type MotoristaGpsIdentidade = {
  origem: MotoristaGpsOrigem;
  cadastroId: string;
  cpf: string;
  nome: string;
  placaCavalo: string | null;
};

export function pinLocalizacaoFromCpf(cpf: string): string {
  const digits = onlyDigits(cpf);
  if (digits.length < 4) return '';
  return digits.slice(-4);
}

export function pinLocalizacaoConfere(cpf: string, pin: string): boolean {
  const expected = pinLocalizacaoFromCpf(cpf);
  const got = onlyDigits(pin);
  if (!expected || expected.length !== 4 || got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

export function assertLatLng(lat: number, lng: number): { lat: number; lng: number } {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Coordenada inválida');
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('Coordenada fora do mapa');
  }
  return { lat, lng };
}

export function motoristaGpsEstaOnline(
  atualizadoEm: Date | null | undefined,
  rastreando: boolean,
  now = new Date(),
  ttlMs = MOTORISTA_GPS_ONLINE_MS,
): boolean {
  if (!rastreando || !atualizadoEm) return false;
  return now.getTime() - atualizadoEm.getTime() <= ttlMs;
}

export function rotuloOrigemGps(origem: MotoristaGpsOrigem): string {
  return origem === MotoristaGpsOrigem.TERCEIRO ? 'Terceiro' : 'Interno';
}
