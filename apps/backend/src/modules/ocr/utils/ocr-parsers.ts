import { isValidIso6346 } from '../../../common/utils/iso6346';

function corrigirOcrLetras(valor: string): string {
  return valor.replace(/0/g, 'O').replace(/1/g, 'I').replace(/5/g, 'S').replace(/8/g, 'B');
}

function corrigirOcrDigitos(valor: string): string {
  return valor.replace(/O/g, '0').replace(/I/g, '1').replace(/S/g, '5').replace(/B/g, '8');
}

function escolherIso(
  candidatos: Array<{ numero: string; confianca: number }>,
): { numero: string; confianca: number } {
  if (!candidatos.length) return { numero: '', confianca: 0 };
  const validos = candidatos.filter((c) => isValidIso6346(c.numero));
  const lista = validos.length ? validos : candidatos;
  return lista.reduce((best, cur) => (cur.confianca > best.confianca ? cur : best));
}

/** ISO: 4 letras do prefixo + 7 dígitos. Ignora a barra do fecho lida como letra extra. */
export function parseContainerNumber(textoBruto: string): { numero: string; confianca: number } {
  if (!textoBruto) return { numero: '', confianca: 0 };

  const texto = textoBruto.toUpperCase().replace(/[\s\-_\n\r]/g, '');
  const candidatos: Array<{ numero: string; confianca: number }> = [];

  for (const m of texto.matchAll(/([A-Z]{4})(?:[A-Z1I|])?(\d{7})/g)) {
    const numero = m[1] + m[2];
    const tinhaBarra = m[0].length === 12;
    candidatos.push({
      numero,
      confianca: isValidIso6346(numero) ? 0.95 : tinhaBarra ? 0.7 : 0.6,
    });
  }

  if (!candidatos.length) {
    const loose = texto.match(/([A-Z0-9]{4})([A-Z0-9]{7})/);
    if (!loose) return { numero: '', confianca: 0 };
    const numero = corrigirOcrLetras(loose[1]) + corrigirOcrDigitos(loose[2]);
    return {
      numero,
      confianca: isValidIso6346(numero) ? 0.75 : 0.4,
    };
  }

  return escolherIso(candidatos);
}

export function parsePlaca(textoBruto: string): { placa: string; confianca: number } {
  if (!textoBruto) return { placa: '', confianca: 0 };

  const texto = textoBruto.toUpperCase().replace(/[\s\-_\n\r]/g, '');

  const mercosulPattern = /([A-Z]{3})(\d)([A-Z])(\d{2})/;
  const mercosulMatch = texto.match(mercosulPattern);

  if (mercosulMatch) {
    const placa = mercosulMatch[1] + mercosulMatch[2] + mercosulMatch[3] + mercosulMatch[4];
    return { placa, confianca: 0.9 };
  }

  const loose7 = texto.match(/([A-Z0-9]{3})([A-Z0-9])([A-Z0-9])([A-Z0-9]{2})/);
  if (loose7) {
    const letras = loose7[1].replace(/0/g, 'O').replace(/1/g, 'I').replace(/5/g, 'S').replace(/8/g, 'B');
    const d1 = loose7[2].replace(/O/g, '0').replace(/I/g, '1').replace(/S/g, '5').replace(/B/g, '8');
    const letra = loose7[3].replace(/0/g, 'O').replace(/1/g, 'I').replace(/5/g, 'S').replace(/8/g, 'B');
    const d2 = loose7[4].replace(/O/g, '0').replace(/I/g, '1').replace(/S/g, '5').replace(/B/g, '8');

    const placaCorrigida = letras + d1 + letra + d2;
    if (/^([A-Z]{3})(\d)([A-Z])(\d{2})$/.test(placaCorrigida)) {
      return { placa: placaCorrigida, confianca: 0.75 };
    }
  }

  const antigoPattern = /([A-Z]{3})(\d{4})/;
  const antigoMatch = texto.match(antigoPattern);

  if (antigoMatch) {
    const placa = antigoMatch[1] + antigoMatch[2];
    return { placa, confianca: 0.9 };
  }

  if (loose7) {
    const letras = loose7[1].replace(/0/g, 'O').replace(/1/g, 'I').replace(/5/g, 'S').replace(/8/g, 'B');
    const digitos = (loose7[2] + loose7[3] + loose7[4])
      .replace(/O/g, '0')
      .replace(/I/g, '1')
      .replace(/S/g, '5')
      .replace(/B/g, '8');

    const placaCorrigida = letras + digitos;
    if (/^([A-Z]{3})(\d{4})$/.test(placaCorrigida)) {
      return { placa: placaCorrigida, confianca: 0.75 };
    }
  }

  const any7 = texto.match(/[A-Z0-9]{7}/);
  if (any7) {
    return { placa: any7[0], confianca: 0.3 };
  }

  return { placa: '', confianca: 0 };
}

export type ContainerOcrPerfil = 'DC' | 'HC' | 'REEFER' | 'OT' | 'TANK' | 'FR';

export type ContainerOcrExtras = {
  tipoIso?: string;
  tamanhoPes?: '20' | '40' | '45';
  perfil?: ContainerOcrPerfil;
  rotulo?: string;
  mgwKg?: string;
  taraKg?: string;
  payloadKg?: string;
  owner?: string;
};

export type OcrIndicativoStatus = 'CONFERE' | 'DIVERGENTE' | 'SEM_CAPTURA';

export type OcrIndicativoTipo = {
  tipoIso: string;
  rotulo: string;
  mgwKg?: string;
  taraKg?: string;
  payloadKg?: string;
  owner?: string;
  status: OcrIndicativoStatus;
  cadastroLabel: string;
  mensagem: string;
};

const ISO_SIZE_TYPE = /\b((?:2[0-6]|4[0-8]|L[0256])[A-Z]\d)\b/g;

const ISO_SIZE_MAP: Record<string, { tamanhoPes: '20' | '40' | '45'; altura: 'DC' | 'HC' }> = {
  '20': { tamanhoPes: '20', altura: 'DC' },
  '21': { tamanhoPes: '20', altura: 'DC' },
  '22': { tamanhoPes: '20', altura: 'DC' },
  '23': { tamanhoPes: '20', altura: 'DC' },
  '24': { tamanhoPes: '20', altura: 'DC' },
  '25': { tamanhoPes: '20', altura: 'HC' },
  '26': { tamanhoPes: '20', altura: 'HC' },
  '40': { tamanhoPes: '40', altura: 'DC' },
  '41': { tamanhoPes: '40', altura: 'DC' },
  '42': { tamanhoPes: '40', altura: 'DC' },
  '43': { tamanhoPes: '40', altura: 'DC' },
  '45': { tamanhoPes: '40', altura: 'HC' },
  '46': { tamanhoPes: '40', altura: 'HC' },
  '47': { tamanhoPes: '40', altura: 'HC' },
  '48': { tamanhoPes: '40', altura: 'DC' },
  L0: { tamanhoPes: '45', altura: 'DC' },
  L2: { tamanhoPes: '45', altura: 'DC' },
  L5: { tamanhoPes: '45', altura: 'HC' },
  L6: { tamanhoPes: '45', altura: 'HC' },
};

/** DC/HC a partir do código ISO da porta (45G1 → HC, 22G1 → DC). */
export function capacidadeDcHcFromTipoIso(tipoIso?: string | null): 'DC' | 'HC' | null {
  const code = String(tipoIso ?? '')
    .trim()
    .toUpperCase();
  if (code.length < 2) return null;
  return ISO_SIZE_MAP[code.slice(0, 2)]?.altura ?? null;
}

function perfilFromIsoLetter(letter: string, altura: 'DC' | 'HC'): ContainerOcrPerfil {
  if (letter === 'R' || letter === 'H') return 'REEFER';
  if (letter === 'U') return 'OT';
  if (letter === 'T') return 'TANK';
  if (letter === 'P') return 'FR';
  return altura;
}

function parsePesoKg(raw: string): string | undefined {
  const compact = raw.replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const n = Number(compact);
  if (!Number.isFinite(n) || n < 100 || n > 200000) return undefined;
  return String(Math.round(n));
}

function pickPeso(texto: string, re: RegExp): string | undefined {
  const m = texto.match(re);
  return m?.[1] ? parsePesoKg(m[1]) : undefined;
}

function normalizeTamanhoPes(value: unknown): '20' | '40' | '45' | '' {
  const raw = String(value ?? '')
    .replace(/['"\s]/g, '')
    .trim()
    .toUpperCase();
  if (raw.startsWith('45')) return '45';
  if (raw.startsWith('40')) return '40';
  if (raw.startsWith('20')) return '20';
  return '';
}

function perfilCadastro(tipo?: string): ContainerOcrPerfil | undefined {
  const t = String(tipo ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  if (!t) return undefined;
  if (t.includes('REEFER') || t === 'RF' || t === 'REF' || t === 'RH') return 'REEFER';
  if (t.includes('OPEN') || t === 'OT') return 'OT';
  if (t.includes('TANK') || t === 'ISO') return 'TANK';
  if (t.includes('FLAT') || t === 'FR') return 'FR';
  if (t.includes('HC') || t === 'HIGHCUBE') return 'HC';
  if (t.includes('DC') || t === 'DRY' || t === 'GP') return 'DC';
  return undefined;
}

export function temContainerOcrExtras(extras?: ContainerOcrExtras | null): boolean {
  return Boolean(extras?.tipoIso || extras?.mgwKg || extras?.taraKg || extras?.payloadKg);
}

export function parseContainerExtras(textoBruto: string): ContainerOcrExtras {
  if (!textoBruto?.trim()) return {};
  const upper = textoBruto.toUpperCase();
  const extras: ContainerOcrExtras = {};

  const codes = [...upper.matchAll(ISO_SIZE_TYPE)].map((m) => m[1]);
  const compact = upper.replace(/[\s\-_\n\r]/g, '');
  const tipoIso =
    codes[0] ?? compact.match(/((?:2[0-6]|4[0-8]|L[0256])[A-Z]\d)/)?.[1];
  if (tipoIso) {
    extras.tipoIso = tipoIso;
    const mapped = ISO_SIZE_MAP[tipoIso.slice(0, 2)];
    if (mapped) {
      extras.tamanhoPes = mapped.tamanhoPes;
      extras.perfil = perfilFromIsoLetter(tipoIso.charAt(2), mapped.altura);
      extras.rotulo = `${mapped.tamanhoPes}' ${extras.perfil}`;
    }
  }

  extras.mgwKg = pickPeso(upper, /(?:MGW|MAX\s*GROSS|MAXGROSS)\s*[:\s]*([\d.,]+)/);
  extras.taraKg = pickPeso(upper, /(?:TARE|TARA|TARE\s*WEIGHT)\s*[:\s]*([\d.,]+)/);
  extras.payloadKg = pickPeso(upper, /(?:PAYLOAD|NET(?:\s*WEIGHT)?)\s*[:\s]*([\d.,]+)/);

  const owner = upper.match(
    /\b(SEACO|MAERSK|MSC|CMA\s*CGM|EVERGREEN|HAPAG|COSCO|YANG\s*MING|TEXTAINER|TRITON|FLORENS)\b/,
  );
  if (owner) extras.owner = owner[1].replace(/\s+/g, ' ');

  return extras;
}

export function compararTipoIsoCadastro(
  extras: ContainerOcrExtras,
  tipoCadastro?: string,
  tamanhoCadastro?: string,
): OcrIndicativoStatus {
  if (!extras.tipoIso) return 'SEM_CAPTURA';
  const tamCad = normalizeTamanhoPes(tamanhoCadastro);
  const perfilCad = perfilCadastro(tipoCadastro);
  const tamOcr = extras.tamanhoPes;
  const perfilOcr = extras.perfil;

  if (!tamOcr && !perfilOcr) return 'SEM_CAPTURA';
  if (!tamCad && !perfilCad) return 'SEM_CAPTURA';

  const tamOk = !tamOcr || !tamCad || tamOcr === tamCad;
  const perfilOk = !perfilOcr || !perfilCad || perfilOcr === perfilCad;
  if ((tamOcr && tamCad) || (perfilOcr && perfilCad)) {
    return tamOk && perfilOk ? 'CONFERE' : 'DIVERGENTE';
  }
  return 'SEM_CAPTURA';
}

export function buildOcrIndicativoTipo(
  extras: ContainerOcrExtras | undefined,
  tipoCadastro?: string,
  tamanhoCadastro?: string,
  cadastroLabel?: string,
): OcrIndicativoTipo | null {
  if (!temContainerOcrExtras(extras)) return null;
  const status = compararTipoIsoCadastro(extras ?? {}, tipoCadastro, tamanhoCadastro);
  const rotulo = extras?.rotulo || extras?.tipoIso || '';
  const tipoPart = extras?.tipoIso
    ? `${extras.tipoIso}${extras.rotulo ? ` · ${extras.rotulo}` : ''}`
    : rotulo;
  let mensagem = tipoPart ? `OCR da porta: ${tipoPart}` : 'OCR da porta';
  if (status === 'CONFERE') mensagem += ' — confere com o cadastro';
  if (status === 'DIVERGENTE') mensagem += ' — diferente do cadastro (indicativo, não trava)';
  return {
    tipoIso: extras?.tipoIso ?? '',
    rotulo,
    mgwKg: extras?.mgwKg,
    taraKg: extras?.taraKg,
    payloadKg: extras?.payloadKg,
    owner: extras?.owner,
    status,
    cadastroLabel: cadastroLabel?.trim() || '',
    mensagem,
  };
}
