export type EmpresaLogoSlot = 'icone' | 'horizontal' | 'portal' | 'documento' | 'email';

export type EmpresaLogoMeta = {
  storageKey: string;
  mime: string;
  nome: string;
  tamanho: number;
  width: number | null;
  height: number | null;
  atualizadoEm: string;
};

export type EmpresaLogoSlotSpec = {
  slot: EmpresaLogoSlot;
  titulo: string;
  ondeAparece: string;
  descricao: string;
  formatos: string;
  dimensoes: string;
  tamanhoMax: string;
  maxBytes: number;
  mimes: readonly string[];
  allowSvg: boolean;
  quadrado?: boolean;
  minLado?: number;
  maxLargura?: number;
  maxAltura?: number;
};

export const EMPRESA_LOGO_SLOTS: readonly EmpresaLogoSlotSpec[] = [
  {
    slot: 'icone',
    titulo: 'Ícone / marca compacta',
    ondeAparece: 'Cabeçalho da intranet, telas de login, portaria mobile e atalho do app',
    descricao: 'Símbolo quadrado com fundo transparente. Evite texto miúdo — some em 36 px.',
    formatos: 'PNG, WEBP ou SVG',
    dimensoes: 'Quadrado 512 × 512 px (aceita 256–1024)',
    tamanhoMax: '400 KB',
    maxBytes: 400 * 1024,
    mimes: ['image/png', 'image/webp', 'image/svg+xml'],
    allowSvg: true,
    quadrado: true,
    minLado: 256,
    maxLargura: 1024,
    maxAltura: 1024,
  },
  {
    slot: 'horizontal',
    titulo: 'Logo horizontal (wordmark)',
    ondeAparece: 'Cabeçalhos com espaço para o nome da empresa',
    descricao: 'Marca + nome lado a lado, fundo transparente, boa leitura em fundo escuro.',
    formatos: 'PNG, WEBP ou SVG',
    dimensoes: '800 × 200 px (máx. 1600 × 400)',
    tamanhoMax: '500 KB',
    maxBytes: 500 * 1024,
    mimes: ['image/png', 'image/webp', 'image/svg+xml'],
    allowSvg: true,
    maxLargura: 1600,
    maxAltura: 400,
    minLado: 160,
  },
  {
    slot: 'portal',
    titulo: 'Logo do portal do cliente',
    ondeAparece: 'Portal do cliente (login, cabeçalho, cadastro e recuperação de senha)',
    descricao: 'É a cara da RL para o cliente. Se vazio, usamos a logo horizontal e depois o ícone.',
    formatos: 'PNG, WEBP ou SVG',
    dimensoes: '800 × 200 px (máx. 1600 × 400)',
    tamanhoMax: '500 KB',
    maxBytes: 500 * 1024,
    mimes: ['image/png', 'image/webp', 'image/svg+xml'],
    allowSvg: true,
    maxLargura: 1600,
    maxAltura: 400,
    minLado: 160,
  },
  {
    slot: 'documento',
    titulo: 'Logo de documentos (RIC / PDF)',
    ondeAparece: 'RIC, comprovante de solicitação e credencial do motorista',
    descricao: 'Fundo claro ou transparente, alto contraste. Sem SVG — o PDF precisa de bitmap.',
    formatos: 'PNG ou JPEG',
    dimensoes: '800 × 200 px (máx. 1600 × 400)',
    tamanhoMax: '400 KB',
    maxBytes: 400 * 1024,
    mimes: ['image/png', 'image/jpeg'],
    allowSvg: false,
    maxLargura: 1600,
    maxAltura: 400,
    minLado: 160,
  },
  {
    slot: 'email',
    titulo: 'Logo de e-mail',
    ondeAparece: 'Cabeçalho dos e-mails do portal (recuperação de senha e avisos)',
    descricao: 'Arquivo leve. Clientes de e-mail bloqueiam SVG.',
    formatos: 'PNG ou JPEG',
    dimensoes: '600 × 160 px (máx. 800 × 240)',
    tamanhoMax: '200 KB',
    maxBytes: 200 * 1024,
    mimes: ['image/png', 'image/jpeg'],
    allowSvg: false,
    maxLargura: 800,
    maxAltura: 240,
    minLado: 120,
  },
] as const;

export const CLIENTE_LOGO_SPEC = {
  titulo: 'Logo do cliente',
  ondeAparece: 'Portal do cliente, ao lado do nome da empresa logada',
  descricao: 'Marca do cliente (não da RL). Quadrado ou horizontal curto, fundo transparente.',
  formatos: 'PNG, WEBP ou SVG',
  dimensoes: '512 × 512 px (aceita 256–1024; horizontal até 1200 × 400)',
  tamanhoMax: '400 KB',
  maxBytes: 400 * 1024,
  mimes: ['image/png', 'image/webp', 'image/svg+xml'] as const,
  minLado: 128,
  maxLargura: 1200,
  maxAltura: 1024,
};

export function isEmpresaLogoSlot(value: string): value is EmpresaLogoSlot {
  return EMPRESA_LOGO_SLOTS.some((s) => s.slot === value);
}

export function specForSlot(slot: EmpresaLogoSlot): EmpresaLogoSlotSpec {
  return EMPRESA_LOGO_SLOTS.find((s) => s.slot === slot)!;
}

export function readImageSize(buffer: Buffer, mime: string): { width: number; height: number } | null {
  if (mime === 'image/svg+xml') return null;
  if (mime === 'image/png') return readPngSize(buffer);
  if (mime === 'image/jpeg') return readJpegSize(buffer);
  if (mime === 'image/webp') return readWebpSize(buffer);
  return null;
}

function readPngSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function readJpegSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 8 < buf.length) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}

function readWebpSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 30) return null;
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8X' && buf.length >= 30) {
    const width = 1 + buf.readUIntLE(24, 3);
    const height = 1 + buf.readUIntLE(27, 3);
    return { width, height };
  }
  if (kind === 'VP8 ' && buf.length >= 30) {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (kind === 'VP8L' && buf.length >= 25) {
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

export function fallbackSlotChain(slot: EmpresaLogoSlot): EmpresaLogoSlot[] {
  if (slot === 'icone') return ['icone'];
  if (slot === 'horizontal') return ['horizontal', 'icone'];
  if (slot === 'portal') return ['portal', 'horizontal', 'icone'];
  if (slot === 'documento') return ['documento', 'horizontal', 'icone'];
  return ['email', 'horizontal', 'icone'];
}
