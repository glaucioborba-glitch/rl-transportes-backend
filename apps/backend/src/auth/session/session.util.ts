/** Converte `7d`, `1h` etc. em segundos (default 7 dias). */
export function parseDurationToSeconds(raw: string | undefined, fallbackSec = 604_800): number {
  if (!raw || typeof raw !== 'string') return fallbackSec;
  const m = /^(\d+)([smhd])$/i.exec(raw.trim());
  if (!m) return fallbackSec;
  const n = parseInt(m[1], 10);
  const u = m[2].toLowerCase();
  if (u === 's') return n;
  if (u === 'm') return n * 60;
  if (u === 'h') return n * 3600;
  if (u === 'd') return n * 86_400;
  return fallbackSec;
}
