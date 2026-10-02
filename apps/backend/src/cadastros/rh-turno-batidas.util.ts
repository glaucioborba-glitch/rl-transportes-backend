import { BadRequestException } from '@nestjs/common';

/** Converte HH:MM em minutos desde 00:00. */
export function hhmmToMinutes(value: string | null | undefined): number | null {
  const raw = value?.trim().slice(0, 5);
  if (!raw) return null;
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Quatro batidas: início < início intervalo < retorno < saída.
 * Intervalo vazio é permitido (jornada contínua).
 */
export function assertBatidasJornada(
  inicio: string,
  intervaloInicio: string | null | undefined,
  intervaloFim: string | null | undefined,
  saida: string,
  rotulo: string,
): void {
  const a = hhmmToMinutes(inicio);
  const b = hhmmToMinutes(intervaloInicio);
  const c = hhmmToMinutes(intervaloFim);
  const d = hhmmToMinutes(saida);
  if (a == null || d == null) {
    throw new BadRequestException(`${rotulo}: informe início e saída.`);
  }
  if (d <= a) {
    throw new BadRequestException(`${rotulo}: a saída deve ser depois do início.`);
  }
  if (b == null && c == null) return;
  if (b == null || c == null) {
    throw new BadRequestException(`${rotulo}: informe início e retorno do intervalo.`);
  }
  if (!(a < b && b < c && c < d)) {
    throw new BadRequestException(
      `${rotulo}: a ordem deve ser início → início do intervalo → retorno → saída.`,
    );
  }
}
