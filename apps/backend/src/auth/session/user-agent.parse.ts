import type { AuthChannel } from './session.types';

/** Heurística leve de UA — sem dependências pesadas. */
export function parseUserAgentParts(ua: string | undefined): {
  navegador: string;
  so: string;
  device: 'desktop' | 'mobile' | 'tablet' | 'unknown';
} {
  const s = (ua || '').slice(0, 512);
  const low = s.toLowerCase();
  let navegador = 'Desconhecido';
  if (/edg/i.test(s)) navegador = 'Edge';
  else if (/opr\/|opera/i.test(s)) navegador = 'Opera';
  else if (/chrome|crios/i.test(s) && !/edg/i.test(s)) navegador = 'Chrome';
  else if (/firefox|fxios/i.test(s)) navegador = 'Firefox';
  else if (/safari/i.test(s) && !/chrome/i.test(s)) navegador = 'Safari';
  else if (/msie|trident/i.test(s)) navegador = 'Internet Explorer';

  let so = 'Desconhecido';
  if (/windows nt/i.test(s)) so = 'Windows';
  else if (/mac os x|macintosh/i.test(s)) so = 'macOS';
  else if (/android/i.test(s)) so = 'Android';
  else if (/iphone|ipad|ipod/i.test(s)) so = 'iOS';
  else if (/linux/i.test(s)) so = 'Linux';

  let device: 'desktop' | 'mobile' | 'tablet' | 'unknown' = 'unknown';
  if (/tablet|ipad(?!.*mobile)/i.test(low) || /ipad/i.test(low)) device = 'tablet';
  else if (/mobile|iphone|ipod|android.*mobile/i.test(low)) device = 'mobile';
  else if (s.length > 0) device = 'desktop';

  return { navegador, so, device };
}

export function deviceLabelFromChannel(
  device: string,
  channel?: AuthChannel,
): string {
  if (device === 'mobile') return 'Mobile';
  if (device === 'tablet') return 'Tablet';
  if (device === 'desktop') return 'Desktop';
  if (channel === 'mobile') return 'Mobile';
  return device === 'unknown' ? 'Desconhecido' : device;
}
